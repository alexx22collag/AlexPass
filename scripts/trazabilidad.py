#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cada criterio de aceptacion debe tener su test, y los criterios deben cubrir los tipos exigidos.

Formato de docs/criterios.md (una linea por criterio):
  - C1 [FUNCIONAL] Al abrir la app veo solo mis ofertas abiertas.
Etiquetas: FUNCIONAL, BORDE, AUTORIZACION, SEGURIDAD, LIMITE, RENDIMIENTO.
Cada test debe nombrar el criterio que comprueba (por ejemplo: test_C1_solo_ofertas_propias).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib

RE_CRIT = re.compile(r'^\s*(?:[-*]\s*)?(?:\*\*)?(C\d+)(?:\*\*)?\s*\[([A-Z_]+)\]\s*(\S.*)$')
RE_ID_TEST = re.compile(r'(?<![A-Za-z0-9])C\d+(?!\d)')


def leer_criterios():
    p = lib.ruta('docs', 'criterios.md')
    items = []
    if not p.exists():
        return items
    for l in p.read_text(encoding='utf-8-sig').splitlines():
        m = RE_CRIT.match(l)
        if m:
            items.append({'id': m.group(1), 'etiqueta': m.group(2), 'texto': m.group(3).strip()})
    return items


def etiquetas_requeridas(f, nivel):
    pol = lib.politica()
    req = set(pol.get('etiquetas_siempre', ['FUNCIONAL', 'BORDE']))
    if nivel is not None and nivel >= 1:
        req.add('SEGURIDAD')
    if f.get('roles_distintos') == 'si':
        req.add('AUTORIZACION')
    if f.get('lee_modifica') == 'modifica':
        req.add('LIMITE')
    return sorted(req)


def ids_en_tests():
    ids = set()
    for p in lib.ficheros_de('tests'):
        try:
            ids |= set(RE_ID_TEST.findall(p.read_text(encoding='utf-8', errors='ignore')))
        except OSError:
            pass
    return ids


def comprobar_criterios():
    pol = lib.politica()
    items = leer_criterios()
    e = lib.estado() or {}
    req = etiquetas_requeridas(lib.leer_ficha(), e.get('nivel_riesgo'))
    minimo = pol.get('criterios_minimos', 3)
    ids = [c['id'] for c in items]
    duplicados = sorted({i for i in ids if ids.count(i) > 1})
    presentes = {c['etiqueta'] for c in items}
    faltan = [t for t in req if t not in presentes]
    return [
        ('TRZ1', len(items) >= minimo, 'Hay %d criterios (minimo %d)' % (len(items), minimo) if len(items) >= minimo else
         'Hay %d criterios y el minimo es %d. Formato: - C1 [FUNCIONAL] texto' % (len(items), minimo)),
        ('TRZ2', not duplicados, 'Identificadores de criterio unicos' if not duplicados else
         'Identificadores repetidos: ' + ', '.join(duplicados)),
        ('TRZ3', not faltan, 'Los criterios cubren los tipos exigidos (%s)' % ', '.join(req) if not faltan else
         'Faltan criterios de tipo: %s (exigidos por la ficha y el nivel de riesgo)' % ', '.join(faltan)),
    ]


def comprobar_tests():
    items = leer_criterios()
    ids_t = ids_en_tests()
    sin_test = [c['id'] for c in items if c['id'] not in ids_t]
    return [('TRZ4', bool(items) and not sin_test, 'Cada criterio tiene al menos un test' if items and not sin_test else
             ('R-08: criterios sin test: ' + ', '.join(sin_test)) if sin_test else 'No hay criterios que probar')]


def comprobar():
    return comprobar_criterios() + comprobar_tests()


def main():
    res = comprobar()
    for cod, ok, msg in res:
        print('[%s] %s %s' % ('OK' if ok else 'FALLA', cod, msg))
    if '--requisitos' in sys.argv:
        e = lib.estado() or {}
        print('Tipos de criterio exigidos: ' + ', '.join(etiquetas_requeridas(lib.leer_ficha(), e.get('nivel_riesgo'))))
    sys.exit(0 if all(ok for _, ok, _ in res) else 1)


if __name__ == '__main__':
    main()
