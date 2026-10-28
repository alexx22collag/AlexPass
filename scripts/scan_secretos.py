#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Busca credenciales y datos reales en el repo. Nunca imprime el valor encontrado.

Uso: python scripts/scan_secretos.py [--datos-reales]
Sale con codigo 1 si encuentra algo.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

PATRONES = [
    ('clave privada', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY')),
    ('AccountKey de Azure', re.compile(r'(?i)AccountKey\s*=\s*[A-Za-z0-9+/=]{20,}')),
    ('firma SAS', re.compile(r'(?i)[?&]sig=[A-Za-z0-9%+/=]{20,}')),
    ('contrasena en cadena de conexion', re.compile(r'(?i)\b(?:password|pwd)\s*=\s*(?!\$\{|%|<|\{\{)[^;\s\'"]{4,}')),
    ('token de GitHub', re.compile(r'\bgh[pousr]_[A-Za-z0-9]{30,}\b')),
    ('JWT', re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')),
    ('token Bearer', re.compile(r'(?i)\bbearer\s+[A-Za-z0-9\-._~+/]{20,}=*')),
    ('URL con usuario y contrasena', re.compile(r'[a-z][a-z0-9+.\-]*://[^/\s:@]+:[^/\s:@]+@')),
    ('secreto de cliente de Entra ID', re.compile(r'\b[A-Za-z0-9_~.\-]{3}8Q~[A-Za-z0-9_~.\-]{30,}')),
    ('clave de AWS', re.compile(r'\bAKIA[0-9A-Z]{16}\b')),
    ('clave de API (sk-)', re.compile(r'\bsk-(?:ant-)?[A-Za-z0-9_\-]{20,}')),
    ('asignacion de secreto', re.compile(
        r'(?i)\b(?:client[_-]?secret|secret|passwd|password|pwd|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|token)'
        r'\b["\']?\s*[:=]\s*["\'](?!<|\$\{|%|\{\{|CAMBIAR|changeme|xxx|your|tu_|\*)([^"\'\s]{8,})["\']')),
]

RE_DNI = re.compile(r'\b\d{8}-?[A-Za-z]\b')
RE_NIE = re.compile(r'\b[XYZxyz]\d{7}-?[A-Za-z]\b')
RE_IBAN = re.compile(r'\bES\d{2}[ ]?(?:\d{4}[ ]?){5}\b')
RE_EMAIL = re.compile(r'\b[A-Za-z0-9._%+\-]+@(?!example\.(?:com|org|net)\b|ejemplo\.)[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')

EXT_BINARIAS = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.xlsx', '.docx', '.woff', '.woff2',
                '.ttf', '.pyc', '.exe', '.dll', '.so'}
# Los ficheros que contienen los propios patrones (o ejemplos de reglas) no se escanean a si mismos.
IGNORAR_ARCHIVOS = {'scripts/scan_secretos.py', 'scripts/guardia.py', 'scripts/registrar_prompt.py'}
IGNORAR_PREFIJOS = ('.claude/', 'it/', 'config/')
EXT_PROHIBIDAS = ('.pem', '.pfx', '.p12', '.key', '.jks', '.publishsettings', '.kdbx')
NOMBRES_PROHIBIDOS = {'local.settings.json', 'id_rsa', 'id_ed25519'}


def contiene_secreto(texto):
    """Nombre del primer patron de credencial que aparece en el texto, o None."""
    for nombre, rx in PATRONES:
        if rx.search(texto or ''):
            return nombre
    return None


def es_env_prohibido(nombre):
    return bool(re.match(r'^\.env(\..+)?$', nombre)) and nombre != '.env.example'


def _texto(path):
    try:
        if path.stat().st_size > 2_000_000:
            return None
        return path.read_text(encoding='utf-8', errors='ignore')
    except OSError:
        return None


def _archivos():
    for p in lib.ficheros_de('.'):
        r = lib.rel(p)
        if r is None or r in IGNORAR_ARCHIVOS or r.startswith(IGNORAR_PREFIJOS):
            continue
        yield p, r


def hallazgos_secretos():
    res = []
    for p, r in _archivos():
        nombre = p.name
        if es_env_prohibido(nombre):
            res.append((r, 0, 'fichero de entorno con valores (no se sube nunca)'))
            continue
        if p.suffix.lower() in EXT_PROHIBIDAS or nombre in NOMBRES_PROHIBIDOS:
            res.append((r, 0, 'fichero que suele contener credenciales'))
            continue
        if p.suffix.lower() in EXT_BINARIAS:
            continue
        t = _texto(p)
        if t is None:
            continue
        for n, linea in enumerate(t.splitlines(), 1):
            if nombre == '.env.example':
                m = re.match(r'^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.*)$', linea)
                if m:
                    v = m.group(1).strip()
                    marcador = re.match(r'^(<.*>|CAMBIAR.*|changeme.*|\$\{.*\}|[01]|true|false|\d{1,6}|)$', v, re.I)
                    if not marcador and len(v) >= 16:
                        res.append((r, n, 'valor real en .env.example'))
                continue
            nombre_patron = contiene_secreto(linea)
            if nombre_patron:
                res.append((r, n, nombre_patron))
    return res


def hallazgos_datos_reales():
    pol = lib.politica()
    permitidos = {x.upper() for x in pol.get('dni_ficticios_permitidos', [])}
    res = []
    for p, r in _archivos():
        if not r.startswith(('tests/', 'maqueta/')) or p.suffix.lower() in EXT_BINARIAS:
            continue
        t = _texto(p)
        if t is None:
            continue
        for n, linea in enumerate(t.splitlines(), 1):
            for rx, que in ((RE_DNI, 'DNI'), (RE_NIE, 'NIE')):
                for m in rx.finditer(linea):
                    if m.group(0).replace('-', '').upper() not in permitidos:
                        res.append((r, n, que + ' con aspecto real'))
            if RE_IBAN.search(linea):
                res.append((r, n, 'IBAN con aspecto real'))
            if RE_EMAIL.search(linea):
                res.append((r, n, 'correo que no es de ejemplo'))
    return res


def comprobar():
    s = hallazgos_secretos()
    d = hallazgos_datos_reales()
    r1 = ('SEC1', not s, 'Sin credenciales en el repositorio' if not s else
          'R-03: posibles credenciales: ' + '; '.join('%s:%s (%s)' % h for h in s[:8]))
    r2 = ('SEC2', not d, 'Sin datos reales en maqueta ni tests' if not d else
          'R-12: datos con aspecto real en maqueta/tests: ' + '; '.join('%s:%s (%s)' % h for h in d[:8]))
    return [r1, r2]


def main():
    res = comprobar()
    for cod, ok, msg in res:
        print('[%s] %s %s' % ('OK' if ok else 'FALLA', cod, msg))
    sys.exit(0 if all(ok for _, ok, _ in res) else 1)


if __name__ == '__main__':
    main()
