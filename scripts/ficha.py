#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Lee y escribe docs/ficha.md validando cada respuesta contra config/campos.json.

Uso:
  python scripts/ficha.py set CLAVE "VALOR"
  python scripts/ficha.py get CLAVE
  python scripts/ficha.py show
  python scripts/ficha.py faltan [r1|r2|r3]
"""
import datetime
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from scan_secretos import contiene_secreto

PLANTILLA = ('---\n# Rellena SOLO con: python scripts/ficha.py set CLAVE "VALOR"\n---\n\n'
             '# Ficha de la app\n\nRespuestas de la entrevista. Las mantiene la skill `entrevista`; no se editan a mano.\n')


def _cargar():
    p = lib.ruta('docs', 'ficha.md')
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(PLANTILLA, encoding='utf-8', newline='\n')
    return p, p.read_text(encoding='utf-8-sig').split('\n')


def validar(clave, valor):
    esq = lib.campos()
    c = esq.get(clave)
    if c is None:
        return None, 'Clave desconocida "%s". Claves validas: %s' % (clave, ', '.join(sorted(esq)))
    valor = ' '.join(valor.split())
    t = c['tipo']
    if t == 'enum':
        if valor not in c['valores']:
            return None, 'Valor no valido para %s. Opciones: %s' % (clave, ', '.join(c['valores']))
    elif t == 'lista':
        items = [x.strip() for x in valor.split(',') if x.strip()]
        malos = [x for x in items if x not in c['valores']]
        if not items or malos:
            return None, 'Valor no valido para %s. Opciones (separadas por coma): %s' % (clave, ', '.join(c['valores']))
        if 'ninguno' in items and len(items) > 1:
            return None, '"ninguno" no se puede combinar con otras opciones.'
        valor = ','.join(items)
    elif t == 'numero':
        if not re.fullmatch(r'\d{1,7}', valor):
            return None, '%s debe ser un numero entero.' % clave
    elif t == 'fecha':
        try:
            datetime.date.fromisoformat(valor)
        except ValueError:
            return None, '%s debe tener formato AAAA-MM-DD.' % clave
    else:
        if len(valor) < 2 or len(valor) > 500:
            return None, '%s debe tener entre 2 y 500 caracteres.' % clave
    nombre = contiene_secreto(valor)
    if nombre:
        return None, 'R-03: el valor parece una credencial (%s). No se guarda. Avisa a IT y no la repitas.' % nombre

    if clave == 'estado_it_datos':
        f = lib.leer_ficha()
        desconocidos = [k for k in lib.CLAVES_DATOS if f.get(k) == 'no_se']
        if valor == 'resuelto':
            if desconocidos:
                return None, 'No se puede marcar resuelto: siguen en no_se -> ' + ', '.join(desconocidos)
            if lib.consulta_it() is not None and not lib.consulta_it_resuelta():
                return None, 'La consulta a IT (docs/consulta-IT.md) no esta respondida del todo.'
        if valor == 'pendiente_it' and lib.consulta_it() is None:
            return None, 'Genera antes docs/consulta-IT.md con la skill preguntar-a-it.'
    return valor, None


def poner(lineas, clave, valor):
    idx = [i for i, l in enumerate(lineas) if l.strip() == '---']
    if len(idx) < 2:
        raise SystemExit('docs/ficha.md no tiene el bloque --- ... --- esperado.')
    ini, fin = idx[0], idx[1]
    for i in range(ini + 1, fin):
        if re.match(r'^\s*%s\s*:' % re.escape(clave), lineas[i]):
            lineas[i] = '%s: %s' % (clave, valor)
            return
    lineas.insert(fin, '%s: %s' % (clave, valor))


def cmd_set(clave, valor):
    valor, error = validar(clave, valor)
    if error:
        print('RECHAZADO: ' + error)
        return 1
    p, lineas = _cargar()
    poner(lineas, clave, valor)
    p.write_text('\n'.join(lineas), encoding='utf-8', newline='\n')
    print('OK %s = %s' % (clave, valor))
    return 0


def cmd_show():
    f = lib.leer_ficha()
    esq = lib.campos()
    for ronda in ('r1', 'r2', 'r3'):
        print('-- %s --' % ronda)
        for k, c in esq.items():
            if c.get('ronda') == ronda:
                print('  %-22s %s' % (k, f.get(k) or '(pendiente)'))
    return 0


def cmd_faltan(ronda):
    f = lib.leer_ficha()
    falt = lib.faltan(f, ronda)
    if falt:
        print('Faltan: ' + ', '.join(falt))
        return 1
    print('No falta ninguna respuesta obligatoria' + (' de %s.' % ronda if ronda else '.'))
    return 0


def main():
    a = sys.argv[1:]
    if len(a) >= 3 and a[0] == 'set':
        sys.exit(cmd_set(a[1], ' '.join(a[2:])))
    if len(a) == 2 and a[0] == 'get':
        print(lib.leer_ficha().get(a[1], ''))
        sys.exit(0)
    if a[:1] == ['show']:
        sys.exit(cmd_show())
    if a[:1] == ['faltan']:
        sys.exit(cmd_faltan(a[1] if len(a) > 1 else None))
    print(__doc__)
    sys.exit(2)


if __name__ == '__main__':
    main()
