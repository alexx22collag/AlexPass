#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Hook PreToolUse de Claude Code. Bloquea de forma determinista lo que no se puede hacer.

Recibe por stdin el JSON del hook. Si bloquea: escribe el motivo en stderr y sale con codigo 2.
Limite conocido: un hook basado en patrones no ve codigo arbitrario ejecutado dentro de un script.
Por eso el pipeline recalcula todo y las ramas protegidas exigen la aprobacion de IT.
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_dependencias
import lib
from scan_secretos import contiene_secreto, es_env_prohibido

PREFIJOS_PROTEGIDOS = ('.claude/', 'scripts/', 'config/', '.github/')
EXACTOS_PROTEGIDOS = {'azure-pipelines.yml', 'CODEOWNERS', 'docs/ESTADO.json', 'docs/ESTADO.md',
                      'docs/.resultado_tests.json', 'docs/.resultado_rojo.json'}
EXT_SECRETAS = ('.pem', '.pfx', '.p12', '.key', '.jks', '.kdbx')
RE_PROTEGIDO_EN_CMD = re.compile(r'(\.claude/|\bscripts/|\bconfig/|\.github/|azure-pipelines\.yml|CODEOWNERS|docs/ESTADO|docs/\.resultado)')
RE_VERBO_ESCRITURA = re.compile(r'(>|\bsed\s+-i|\btee\b|\bcp\b|\bmv\b|\brm\b|\bdel\b|\bSet-Content\b|\bOut-File\b|\bAdd-Content\b|'
                                r'\bRemove-Item\b|\bchmod\b|\bgit\s+(checkout|restore|reset)\b)', re.I)
RE_NUESTRO_SCRIPT = re.compile(r'^\s*(?:python3?|py)(?:\.exe)?\s+(?:\./)?scripts/'
                               r'(estado|ficha|clasificar_riesgo|ejecutar_tests|validar|trazabilidad|scan_secretos|'
                               r'check_dependencias|check_estructura)\.py\b[^>]*$')


def bloquear(regla, motivo, que_hacer):
    sys.stderr.write('BLOQUEADO [%s] %s Que hacer: %s\n' % (regla, motivo, que_hacer))
    sys.exit(2)


def ruta_relativa(p, cwd):
    if not p:
        return None
    p = os.path.normpath(p if os.path.isabs(p) else os.path.join(cwd, p))
    return lib.rel(p)


def es_secreto_fichero(r):
    n = os.path.basename(r or '')
    return es_env_prohibido(n) or n.lower().endswith(EXT_SECRETAS) or n == 'local.settings.json'


def es_protegido(r):
    return bool(r) and (r.startswith(PREFIJOS_PROTEGIDOS) or r in EXACTOS_PROTEGIDOS)


def rama_actual():
    try:
        p = subprocess.run(['git', 'symbolic-ref', '--short', 'HEAD'], cwd=str(lib.RAIZ), capture_output=True,
                           text=True, timeout=10)
        return p.stdout.strip() if p.returncode == 0 else None
    except Exception:
        return None


def contenido_escrito(ti):
    partes = []
    for k in ('content', 'new_string', 'new_source'):
        if isinstance(ti.get(k), str):
            partes.append(ti[k])
    for ed in ti.get('edits') or []:
        if isinstance(ed, dict) and isinstance(ed.get('new_string'), str):
            partes.append(ed['new_string'])
    return '\n'.join(partes)


def revisar_herramienta_fichero(nombre, ti, cwd):
    ruta_f = ti.get('file_path') or ti.get('path') or ti.get('notebook_path')
    r = ruta_relativa(ruta_f, cwd)
    if nombre == 'Read':
        if es_secreto_fichero(r or ruta_f):
            bloquear('R-03', 'No se leen ficheros con credenciales.', 'Las conexiones las pone IT; usa .env.example solo para ver los nombres de variables.')
        return
    if es_secreto_fichero(r or ruta_f):
        bloquear('R-03', 'No se escriben ficheros de credenciales (.env, claves, certificados).', 'Los valores reales los define IT en el entorno; aqui solo se documentan nombres en .env.example.')
    if es_protegido(r):
        bloquear('R-17', 'Fichero protegido de IT (%s).' % r, 'Si hace falta un cambio, pidelo a IT. No intentes rodearlo.')
    nombre_secreto = contiene_secreto(contenido_escrito(ti))
    if nombre_secreto:
        bloquear('R-03', 'El contenido parece contener una credencial (%s).' % nombre_secreto,
                 'Usa una variable de entorno y su nombre en .env.example; nunca el valor.')
    e = lib.estado()
    if not e or not r:
        return
    fase = e.get('fase')
    if r.startswith(('src/', 'tests/')):
        if fase in ('r1', 'r2', 'r3'):
            bloquear('R-02', 'No se escribe codigo ni tests antes de que los requisitos esten aprobados (fase actual: %s).' % fase,
                     'Termina la entrevista y la aprobacion; el estado lo marca: python scripts/estado.py status')
        if fase == 'done':
            bloquear('R-18', 'La app ya esta entregada a revision de IT.', 'Un cambio nuevo se registra con: python scripts/estado.py cambio-alcance --motivo "..."')
        if e.get('nivel_riesgo') == 3 or (e.get('nivel_riesgo') is None and fase != 'r1'):
            bloquear('R-07', 'Nivel de riesgo 3 o sin clasificar: esta app no la construye el usuario.', 'Pasa la ficha a IT.')
    if r in ('docs/REQUISITOS.md', 'docs/criterios.md') and fase in ('build', 'verify', 'publish', 'done'):
        bloquear('R-15', 'Los requisitos aprobados no se tocan (fase %s).' % fase,
                 'Un cambio de alcance se registra con: python scripts/estado.py cambio-alcance --motivo "..." (vuelve a la ronda 3 y hay que reaprobar).')


def frase_de(cmd):
    m = re.search(r'--frase\s+(?:"([^"]*)"|\'([^\']*)\'|(\S+))', cmd)
    if not m:
        return None
    return next(g for g in m.groups() if g is not None)


def revisar_segmento(seg):
    s = seg.strip()
    if not s:
        return
    ratio_ok = bool(RE_NUESTRO_SCRIPT.match(s))
    if re.search(r'estado\.py\s+(aprobar-it|confirmar-descenso)\b', s):
        bloquear('R-11', 'Esa aprobacion solo la da IT.', 'Pidesela a IT; Claude no puede darla.')
    if re.search(r'estado\.py\s+aprobar\b(?!-)', s):
        frase = frase_de(s)
        ultimo = lib.ruta('.claude', 'ultimo_prompt.txt')
        texto = ultimo.read_text(encoding='utf-8', errors='ignore') if ultimo.exists() else ''
        if not frase or frase not in texto:
            bloquear('R-12', 'La aprobacion del usuario debe haberla escrito el usuario en su ultimo mensaje, tal cual.',
                     'Ejecuta "python scripts/estado.py frase", muestrale la frase y espera a que la escriba. No la rellenes tu.')
    if re.search(r'\bgit\b[^|;&]*\bpush\b', s):
        ramas = lib.politica().get('ramas_protegidas', ['main', 'master', 'prod', 'release'])
        destino_protegido = any(re.search(r'(?<![\w/.-])(%s)(?![\w/.-])' % re.escape(b), s) for b in ramas)
        if re.search(r'--force|--force-with-lease|\s-f(\s|$)|--mirror|--delete|\s:\S', s) or destino_protegido or rama_actual() in ramas:
            bloquear('R-11', 'No se sube directamente a una rama protegida ni se fuerzan subidas.',
                     'Trabaja en una rama de la app y abre una solicitud de revision; IT la aprueba.')
    if re.search(r'\bgit\b[^|;&]*\bcommit\b', s) and rama_actual() in lib.politica().get('ramas_protegidas', ['main', 'master', 'prod', 'release']):
        bloquear('R-11', 'No se hacen commits en una rama protegida.', 'Crea una rama: git checkout -b app/<nombre>')
    if re.search(r'--no-verify|core\.hooksPath|filter-branch|update-ref', s):
        bloquear('R-17', 'No se puede saltar ni alterar los controles de git.', 'Los controles los gestiona IT.')
    if re.search(r'(?i)\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(sh|bash|zsh|iex|Invoke-Expression|python3?)\b', s):
        bloquear('R-19', 'No se ejecuta codigo descargado de internet.', 'Descarga, revisa con IT y solo entonces usalo.')
    if re.search(r'(?i)(\bexport\s+|\bsetx?\s+|\$env:)\w*(key|secret|token|passw|pwd)\w*\s*=', s):
        bloquear('R-03', 'No se definen secretos desde la linea de comandos.', 'Las credenciales las pone IT en el entorno de ejecucion.')
    if re.search(r'(?i)\baz\s+(login|account|ad|keyvault|role|devops\s+login)\b', s):
        bloquear('R-04', 'Las conexiones y permisos de Azure los gestiona IT.', 'Pide a IT la identidad con la skill preguntar-a-it.')
    if re.search(r'\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*\s+(/|~|\$HOME|\.|\*)(\s|$)', s):
        bloquear('R-17', 'Borrado masivo no permitido.', 'Borra solo ficheros concretos de src/ o tests/.')
    if not ratio_ok and re.search(r'(?<![\w.])\.env(?!\.example)\b', s):
        bloquear('R-03', 'No se manipulan ficheros .env.', 'Usa .env.example para documentar nombres de variables.')
    if not ratio_ok and RE_PROTEGIDO_EN_CMD.search(s) and RE_VERBO_ESCRITURA.search(s):
        bloquear('R-17', 'No se modifican los ficheros de IT desde la linea de comandos.', 'Pidelo a IT.')
    paquetes, problemas = check_dependencias.paquetes_de_comando(s)
    if problemas:
        bloquear('R-10', 'Origen de paquetes no permitido (%s).' % '; '.join(problemas), 'Solo se instalan paquetes de la lista aprobada.')
    permitidos = check_dependencias.cargar_permitidos()
    nuevos = [('%s:%s' % (eco, n)) for eco, n in paquetes if check_dependencias.norm(eco, n) not in permitidos]
    if nuevos:
        bloquear('R-10', 'Paquetes fuera de la lista aprobada: %s.' % ', '.join(nuevos),
                 'Pide a IT que lo apruebe (config/dependencias-permitidas.txt) o usa uno de la lista.')


def main():
    try:
        datos = json.load(sys.stdin)
    except Exception:
        sys.stderr.write('BLOQUEADO [R-17] El hook no pudo leer la entrada. Que hacer: avisa a IT.\n')
        sys.exit(2)
    nombre = datos.get('tool_name', '')
    ti = datos.get('tool_input') or {}
    cwd = datos.get('cwd') or os.getcwd()
    if nombre in ('Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit'):
        revisar_herramienta_fichero(nombre, ti, cwd)
    elif nombre == 'Bash':
        cmd = ti.get('command', '')
        for seg in re.split(r'&&|;|\|\||\n', cmd):
            revisar_segmento(seg)
    sys.exit(0)


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # fallo cerrado: ante un error propio, se bloquea
        sys.stderr.write('BLOQUEADO [R-17] Error interno del guardia (%s). Que hacer: avisa a IT.\n' % exc)
        sys.exit(2)
