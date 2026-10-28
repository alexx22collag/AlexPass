#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Comprueba que las dependencias estan en la lista aprobada por IT y con version fija.

Lee requirements*.txt, package.json y *.csproj. Lista aprobada: config/dependencias-permitidas.txt
(formato  ecosistema:nombre, con ecosistema python | npm | nuget).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib


def norm(eco, nombre):
    n = nombre.strip().lower()
    if eco == 'python':
        n = re.sub(r'[-_.]+', '-', n)
    return '%s:%s' % (eco, n)


def cargar_permitidos():
    res = set()
    p = lib.ruta('config', 'dependencias-permitidas.txt')
    if p.exists():
        for l in p.read_text(encoding='utf-8').splitlines():
            l = l.split('#', 1)[0].strip()
            if ':' in l:
                eco, nombre = l.split(':', 1)
                res.add(norm(eco.strip().lower(), nombre))
    return res


def dependencias():
    """Devuelve lista de (archivo, ecosistema, nombre, problema_o_None)."""
    res = []
    for p in lib.ficheros_de('.'):
        r = lib.rel(p)
        if r is None or r.startswith(('.claude/', 'it/')):
            continue
        n = p.name.lower()
        if re.match(r'^requirements.*\.txt$', n):
            for linea in p.read_text(encoding='utf-8', errors='ignore').splitlines():
                l = linea.split('#', 1)[0].strip()
                if not l or l.startswith(('-r', '--requirement', '-c', '--constraint')):
                    continue
                if l.startswith(('-e', '--editable', '--index-url', '--extra-index-url', '-i ', '--find-links', '-f ')) \
                        or '://' in l or l.startswith('git+'):
                    res.append((r, 'python', l[:40], 'origen externo no permitido'))
                    continue
                m = re.match(r'^([A-Za-z0-9][A-Za-z0-9_.\-]*)(\[[^\]]*\])?\s*(==|>=|<=|~=|!=|>|<)?\s*([^\s;]*)', l)
                if not m:
                    continue
                prob = None if m.group(3) == '==' and m.group(4) else 'version no fija (usa ==)'
                res.append((r, 'python', m.group(1), prob))
        elif n == 'package.json':
            try:
                data = json.loads(p.read_text(encoding='utf-8-sig'))
            except ValueError:
                res.append((r, 'npm', 'package.json', 'JSON no valido'))
                continue
            for sec in ('dependencies', 'devDependencies', 'optionalDependencies'):
                for nombre, ver in (data.get(sec) or {}).items():
                    prob = None if re.match(r'^\d+\.\d+\.\d+(-[\w.]+)?$', str(ver)) else 'version no fija (%s)' % ver
                    res.append((r, 'npm', nombre, prob))
        elif n.endswith('.csproj'):
            txt = p.read_text(encoding='utf-8', errors='ignore')
            for m in re.finditer(r'<PackageReference\b([^>]*)>', txt):
                attrs = m.group(1)
                inc = re.search(r'Include="([^"]+)"', attrs)
                ver = re.search(r'Version="([^"]+)"', attrs)
                if not inc:
                    continue
                ok = ver and re.match(r'^\d+(\.\d+){1,3}(-[\w.]+)?$', ver.group(1))
                res.append((r, 'nuget', inc.group(1), None if ok else 'version no fija'))
    return res


def comprobar():
    permitidos = cargar_permitidos()
    deps = dependencias()
    no_lista = sorted({'%s:%s' % (e, n) for _, e, n, _ in deps if norm(e, n) not in permitidos})
    sin_fijar = sorted({'%s (%s)' % (n, pr) for _, _, n, pr in deps if pr})
    if not deps:
        return [('DEP1', True, 'Sin manifiestos de dependencias')]
    return [
        ('DEP1', not no_lista, 'Todas las dependencias estan en la lista aprobada' if not no_lista else
         'R-10: dependencias fuera de la lista aprobada: ' + ', '.join(no_lista[:10])),
        ('DEP2', not sin_fijar, 'Todas con version fija y origen permitido' if not sin_fijar else
         'R-10: version no fija u origen no permitido: ' + ', '.join(sin_fijar[:10])),
    ]


def paquetes_de_comando(cmd):
    """Para el hook: paquetes que un comando de instalacion intenta anadir. -> (lista, problemas)."""
    paquetes, problemas = [], []
    for seg in re.split(r'&&|;|\|\||\|', cmd):
        t = seg.split()
        if not t:
            continue
        j = ' '.join(t)
        m = re.search(r'\b(?:pip3?|(?:python3?|py)\s+-m\s+pip)\s+install\b(.*)$', j)
        if m:
            args = m.group(1).split()
            i = 0
            while i < len(args):
                a = args[i]
                if a in ('-r', '--requirement', '-c', '--constraint'):
                    i += 2
                    continue
                if a in ('-e', '--editable', '-i', '--index-url', '--extra-index-url', '-f', '--find-links'):
                    problemas.append('origen externo: ' + a)
                    i += 2
                    continue
                if a.startswith('-'):
                    i += 1
                    continue
                if '://' in a or a.startswith('git+') or a.startswith(('.', '/')):
                    problemas.append('origen externo: ' + a)
                else:
                    nm = re.match(r'^[A-Za-z0-9][A-Za-z0-9_.\-]*', a)
                    if nm:
                        paquetes.append(('python', nm.group(0)))
                i += 1
            continue
        m = re.search(r'\b(?:npm|pnpm|yarn)\s+(?:install|i|add)\b(.*)$', j)
        if m:
            for a in m.group(1).split():
                if a.startswith('-'):
                    continue
                if '://' in a or a.startswith(('.', '/', 'git+', 'github:')):
                    problemas.append('origen externo: ' + a)
                    continue
                nombre = ('@' + a[1:].split('@')[0]) if a.startswith('@') else a.split('@')[0]
                paquetes.append(('npm', nombre))
            continue
        m = re.search(r'\bdotnet\s+add\s+(?:\S+\s+)?package\s+(\S+)', j)
        if m:
            paquetes.append(('nuget', m.group(1)))
    return paquetes, problemas


def main():
    res = comprobar()
    for cod, ok, msg in res:
        print('[%s] %s %s' % ('OK' if ok else 'FALLA', cod, msg))
    sys.exit(0 if all(ok for _, ok, _ in res) else 1)


if __name__ == '__main__':
    main()
