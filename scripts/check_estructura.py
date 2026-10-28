#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Comprueba la estructura del repo y que los ficheros de IT no se han tocado (manifest)."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from scan_secretos import es_env_prohibido


def comprobar():
    pol = lib.politica()
    res = []
    faltan = [f for f in pol.get('ficheros_obligatorios', []) if not lib.ruta(f).exists()]
    hay_pipeline = lib.ruta('.github', 'workflows', 'validar.yml').exists() or lib.ruta('azure-pipelines.yml').exists()
    if not hay_pipeline:
        faltan.append('pipeline (.github/workflows/validar.yml o azure-pipelines.yml)')
    res.append(('EST1', not faltan, 'Estructura obligatoria presente' if not faltan else
                'Faltan ficheros obligatorios: ' + ', '.join(faltan)))

    gi = lib.ruta('.gitignore')
    txt = gi.read_text(encoding='utf-8', errors='ignore') if gi.exists() else ''
    lineas = {l.strip() for l in txt.splitlines()}
    ok_gi = '.env' in lineas and '.env.*' in lineas
    res.append(('EST2', ok_gi, '.gitignore protege los ficheros .env' if ok_gi else
                'R-03: .gitignore debe contener las lineas .env y .env.*'))

    envs = [lib.rel(p) for p in lib.ficheros_de('.') if es_env_prohibido(p.name)]
    res.append(('EST3', not envs, 'No hay ficheros .env' if not envs else
                'R-03: hay ficheros .env en el repo: ' + ', '.join(envs)))

    man = lib.leer_manifest()
    if man is None:
        res.append(('EST4', False, 'R-17: falta config/manifest.sha256 (lo genera IT)'))
    else:
        actual = lib.calcular_manifest()
        cambiados = sorted([k for k in man if actual.get(k) != man[k]] + [k for k in actual if k not in man])
        res.append(('EST4', not cambiados, 'Los ficheros de IT (scripts, config, skills, pipelines) no se han tocado' if not cambiados else
                    'R-17: ficheros de IT modificados: ' + ', '.join(cambiados[:8])))
    return res


def main():
    res = comprobar()
    for cod, ok, msg in res:
        print('[%s] %s %s' % ('OK' if ok else 'FALLA', cod, msg))
    sys.exit(0 if all(ok for _, ok, _ in res) else 1)


if __name__ == '__main__':
    main()
