#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ejecuta los tests de verdad y deja constancia. Un "pasan" sin esta constancia no cuenta.

Uso:
  python scripts/ejecutar_tests.py --rojo    # ANTES de escribir el codigo: los tests deben FALLAR
  python scripts/ejecutar_tests.py           # despues: deben pasar; guarda docs/.resultado_tests.json
El comando de tests lo define IT en config/politica.json (test_cmd).
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

F_VERDE = ('docs', '.resultado_tests.json')
F_ROJO = ('docs', '.resultado_rojo.json')


def hash_codigo():
    return lib.sha256_ficheros(lib.ficheros_de('src', 'tests'))


def correr():
    cmd = lib.politica().get('test_cmd', '')
    if not cmd:
        return None, 'IT no ha configurado test_cmd en config/politica.json'
    try:
        p = subprocess.run(cmd, shell=True, cwd=str(lib.RAIZ), capture_output=True, text=True, timeout=900)
    except subprocess.TimeoutExpired:
        return 124, 'Tiempo agotado (15 min)'
    return p.returncode, (p.stdout + p.stderr)[-3000:]


def hashes_tests():
    return {lib.rel(p): lib.sha256_de(p) for p in lib.ficheros_de('tests')}


def cmd_rojo():
    if not lib.ficheros_de('tests'):
        print('RECHAZADO: no hay tests en tests/. Escribelos a partir de docs/criterios.md.')
        return 1
    codigo, salida = correr()
    if codigo is None:
        print('RECHAZADO: ' + salida)
        return 1
    print(salida)
    if codigo == 0:
        print('RECHAZADO (R-08): los tests PASAN sin que exista el codigo. No comprueban nada. Reescribelos.')
        return 1
    lib.guardar_json(lib.ruta(*F_ROJO), {'fecha': lib.ahora(), 'codigo': codigo, 'ficheros': hashes_tests()})
    print('OK: los tests fallan como deben (codigo %s). Constancia guardada.' % codigo)
    return 0


def cmd_verde():
    codigo, salida = correr()
    if codigo is None:
        print('RECHAZADO: ' + salida)
        return 1
    print(salida)
    lib.guardar_json(lib.ruta(*F_VERDE), {'fecha': lib.ahora(), 'codigo': codigo, 'hash': hash_codigo(),
                                          'cmd': lib.politica().get('test_cmd', ''), 'salida': salida[-1500:]})
    print('RESULTADO TESTS: ' + ('PASAN' if codigo == 0 else 'FALLAN (codigo %s)' % codigo))
    return 0 if codigo == 0 else 1


def comprobar_rojo():
    r = lib.leer_json(lib.ruta(*F_ROJO))
    if not r:
        return [('TST1', False, 'R-08: no hay constancia de que los tests fallaran antes del codigo (ejecutar_tests.py --rojo)')]
    cambiados = []
    actuales = hashes_tests()
    for f, h in (r.get('ficheros') or {}).items():
        if actuales.get(f) != h:
            cambiados.append(f)
    return [('TST1', not cambiados, 'Los tests vistos en rojo no se han tocado' if not cambiados else
             'R-08: tests modificados o borrados tras verlos fallar: ' + ', '.join(cambiados) +
             ' (si el test estaba mal, usa estado.py cambio-alcance)')]


def comprobar_fresco():
    r = lib.leer_json(lib.ruta(*F_VERDE))
    if not r:
        return [('TST2', False, 'R-09: no hay resultado de tests. Ejecuta: python scripts/ejecutar_tests.py')]
    if r.get('hash') != hash_codigo():
        return [('TST2', False, 'R-09: el codigo o los tests han cambiado desde la ultima ejecucion. Vuelve a ejecutarlos.')]
    return [('TST2', r.get('codigo') == 0, 'Tests ejecutados sobre el codigo actual: pasan' if r.get('codigo') == 0 else
             'Los tests fallan (codigo %s)' % r.get('codigo'))]


def main():
    sys.exit(cmd_rojo() if '--rojo' in sys.argv else cmd_verde())


if __name__ == '__main__':
    main()
