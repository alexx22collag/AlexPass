#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validacion unica de IT. La ejecutan el pipeline (--ci) y las skills (sin --ci).

Con --ci: ejecuta los tests de verdad y recalcula TODAS las puertas desde cero (no se fia de ESTADO.json).
Sin --ci: comprobaciones locales segun la fase en la que esta la app.
"""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_dependencias
import check_estructura
import ejecutar_tests
import estado
import lib
import scan_secretos
import trazabilidad


def main():
    ci = '--ci' in sys.argv
    res = []
    res += check_estructura.comprobar()
    res += scan_secretos.comprobar()
    res += check_dependencias.comprobar()
    e = lib.estado() or {}
    fase = e.get('fase', 'r1')
    if ci or fase in ('build', 'verify', 'publish', 'done'):
        res += trazabilidad.comprobar()
        res += ejecutar_tests.comprobar_rojo()
        if ci:
            codigo = ejecutar_tests.cmd_verde()
            res.append(('CI1', codigo == 0, 'Tests ejecutados por el pipeline: pasan' if codigo == 0 else 'Los tests fallan en el pipeline'))
        else:
            res += ejecutar_tests.comprobar_fresco()
    for cmd in lib.politica().get('auditoria_cmds', []):
        p = subprocess.run(cmd, shell=True, cwd=str(lib.RAIZ), capture_output=True, text=True)
        res.append(('AUD', p.returncode == 0, 'Auditoria de dependencias: ' + cmd + (' OK' if p.returncode == 0 else ' FALLA')))
    print('VALIDACION%s' % (' (pipeline)' if ci else ''))
    for cod, ok, msg in res:
        print('  [%s] %-6s %s' % ('OK' if ok else 'FALLA', cod, msg))
    todo = all(ok for _, ok, _ in res)
    if ci:
        todo = (estado.verificar_todo() == 0) and todo
    print('RESULTADO FINAL: ' + ('APROBADA' if todo else 'RECHAZADA'))
    sys.exit(0 if todo else 1)


if __name__ == '__main__':
    main()
