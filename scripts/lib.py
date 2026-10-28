# -*- coding: utf-8 -*-
"""Utilidades comunes de los scripts de crear-app. Solo biblioteca estandar."""
import datetime
import hashlib
import json
import os
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
IGNORAR_DIRS = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', '.pytest_cache', 'bin', 'obj', 'dist'}
# Ficheros que definen las reglas del juego: solo IT los cambia (CODEOWNERS + manifest + hook).
PROTEGIDOS = ['scripts', 'config', '.claude/settings.json', '.claude/skills', '.github',
              'azure-pipelines.yml', 'CODEOWNERS']
# Respuestas de la ficha que "se deberian saber". Si alguna es no_se, el nivel de riesgo es provisional.
CLAVES_DATOS = ['entorno_datos', 'objeto_datos', 'responsable_datos', 'acceso_actual', 'datos_personales',
                'datos_economicos', 'conexion_externa', 'usuarios_externos', 'lee_modifica', 'reversible']


def ruta(*partes):
    return RAIZ.joinpath(*partes)


def rel(path):
    try:
        return pathlib.Path(path).resolve().relative_to(RAIZ.resolve()).as_posix()
    except (ValueError, OSError):
        return None


def leer_json(path, defecto=None):
    try:
        with open(path, encoding='utf-8-sig') as f:
            return json.load(f)
    except FileNotFoundError:
        return defecto


def guardar_json(path, datos):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write('\n')


def politica():
    return leer_json(ruta('config', 'politica.json'), {})


def campos():
    return leer_json(ruta('config', 'campos.json'), {})


def estado():
    return leer_json(ruta('docs', 'ESTADO.json'), None)


def ahora():
    return datetime.datetime.now().replace(microsecond=0).isoformat()


def texto_normalizado(path):
    """Bytes del fichero con saltos de linea LF, para que Windows/Linux den el mismo hash."""
    return pathlib.Path(path).read_bytes().replace(b'\r\n', b'\n')


def sha256_de(path):
    return hashlib.sha256(texto_normalizado(path)).hexdigest()


def sha256_ficheros(paths):
    h = hashlib.sha256()
    for p in sorted(paths, key=lambda x: str(rel(x))):
        h.update(str(rel(p)).encode('utf-8'))
        h.update(b'\0')
        h.update(texto_normalizado(p))
        h.update(b'\0')
    return h.hexdigest()


def hash_aprobacion():
    """Hash de REQUISITOS.md + criterios.md: lo que el usuario aprueba."""
    ps = [ruta('docs', 'REQUISITOS.md'), ruta('docs', 'criterios.md')]
    if not all(p.exists() for p in ps):
        return None
    return sha256_ficheros(ps)


def ficheros_de(*carpetas):
    res = []
    for c in carpetas:
        base = ruta(c)
        if base.is_file():
            res.append(base)
            continue
        if not base.is_dir():
            continue
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORAR_DIRS]
            for fn in files:
                if fn == '.gitkeep' or fn.endswith('.pyc'):
                    continue
                res.append(pathlib.Path(root) / fn)
    return sorted(res)


def lista_protegidos():
    return [p for p in ficheros_de(*PROTEGIDOS) if p.name != 'manifest.sha256']


def calcular_manifest():
    return {rel(p): sha256_de(p) for p in lista_protegidos()}


def escribir_manifest():
    m = calcular_manifest()
    destino = ruta('config', 'manifest.sha256')
    with open(destino, 'w', encoding='utf-8', newline='\n') as f:
        for k in sorted(m):
            f.write('%s  %s\n' % (m[k], k))
    return len(m)


def leer_manifest():
    p = ruta('config', 'manifest.sha256')
    res = {}
    if not p.exists():
        return None
    for linea in p.read_text(encoding='utf-8').splitlines():
        partes = linea.split('  ', 1)
        if len(partes) == 2:
            res[partes[1].strip()] = partes[0].strip()
    return res


def leer_ficha():
    """Lee el bloque entre --- de docs/ficha.md como diccionario plano clave: valor."""
    p = ruta('docs', 'ficha.md')
    campos_ficha = {}
    if not p.exists():
        return campos_ficha
    dentro = False
    with open(p, encoding='utf-8-sig') as f:
        for linea in f:
            l = linea.rstrip('\n').rstrip('\r')
            if l.strip() == '---':
                if not dentro:
                    dentro = True
                    continue
                break
            if dentro:
                if not l.strip() or l.lstrip().startswith('#'):
                    continue
                if ':' in l:
                    k, v = l.split(':', 1)
                    campos_ficha[k.strip()] = v.strip()
    return campos_ficha


def valores_lista(v):
    return [x.strip() for x in (v or '').split(',') if x.strip()]


def requerido(clave, c, ficha):
    if not c.get('obligatorio'):
        return False
    cu = c.get('cuando')
    if cu:
        v = ficha.get(cu['clave'], '')
        if 'igual' in cu:
            return v == cu['igual']
        if 'en' in cu:
            return v in cu['en']
    return True


def faltan(ficha, ronda=None):
    res = []
    for k, c in campos().items():
        if ronda and c.get('ronda') != ronda:
            continue
        if requerido(k, c, ficha) and not ficha.get(k):
            res.append(k)
    return res


def consulta_it():
    p = ruta('docs', 'consulta-IT.md')
    if not p.exists():
        return None
    return p.read_text(encoding='utf-8-sig')


def consulta_it_resuelta():
    """True si docs/consulta-IT.md tiene todas las preguntas marcadas y una respuesta con nombre."""
    t = consulta_it()
    if t is None:
        return False
    if re.search(r'^\s*-\s*\[ \]', t, re.M):
        return False
    if not re.search(r'respondido_por:\s*\S+', t):
        return False
    m = re.search(r'## Respuesta de IT\s*(.*?)(?=\n## |\Z)', t, re.S)
    cuerpo = (m.group(1) if m else '')
    cuerpo = re.sub(r'(respondido_por|fecha):.*', '', cuerpo).strip()
    return len(cuerpo) >= 20 and 'IT rellena' not in cuerpo
