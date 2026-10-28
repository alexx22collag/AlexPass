#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Calcula el nivel de riesgo (0-3) a partir de la ficha. El nivel NO se negocia.

Uso: python scripts/clasificar_riesgo.py [--escribir]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib


def clasificar(f):
    pol = lib.politica()
    origen = lib.valores_lista(f.get('origen_datos', ''))
    datos_empresa = bool(origen) and origen != ['ninguno']
    lm = f.get('lee_modifica', '')
    modifica = lm in ('modifica', 'no_se')  # ante la duda, el peor caso
    motivos, bloqueos = [], []
    nivel = 0

    if f.get('acceso_actual') == 'cuenta_compartida':
        bloqueos.append('R-05: la app no puede usar una cuenta compartida. IT debe crear una identidad propia para la app.')
    if datos_empresa:
        nivel = 1
        motivos.append('Usa datos de la empresa')
    if lm == 'modifica':
        nivel = max(nivel, 2)
        motivos.append('Modifica datos de la empresa')
    if f.get('conexion_externa') in ('si', 'no_se'):
        nivel = max(nivel, 2)
        motivos.append('Puede enviar datos fuera de la empresa o usar un servicio de terceros')
    if f.get('usuarios_externos') in ('si', 'no_se'):
        nivel = max(nivel, 2)
        motivos.append('Podria usarla gente ajena a la empresa')
    if f.get('datos_personales') == 'si' and f.get('exporta_datos') == 'si':
        nivel = max(nivel, 2)
        motivos.append('Exporta datos personales')

    try:
        vol = int(f.get('volumen_modificacion') or 0)
    except ValueError:
        vol = 0
    critico = any(p in (f.get('objeto_datos', '') or '').lower() for p in pol.get('palabras_criticas_objeto', []))
    if modifica and f.get('entorno_datos') in ('produccion', 'no_se') and (
            'sap' in origen or vol > pol.get('umbral_registros_nivel3', 50) or critico or f.get('reversible') == 'no'):
        nivel = 3
        motivos.append('Modifica en produccion con riesgo alto (SAP, mucho volumen, facturacion o no reversible)')

    revision_it = f.get('datos_personales') == 'si' or f.get('datos_economicos') == 'si'
    if revision_it:
        motivos.append('Maneja datos personales o economicos: la revision de IT es obligatoria')

    desconocidos = [k for k in lib.CLAVES_DATOS if f.get(k) == 'no_se']
    provisional = bool(desconocidos)
    if provisional:
        nivel = max(nivel, 2)
        motivos.append('Hay respuestas no_se (%s): se trata como minimo de nivel 2 hasta resolverlas con IT' % ', '.join(desconocidos))

    niveles = pol.get('niveles', {})
    info = niveles.get(str(nivel), {})
    return {'nivel': nivel, 'provisional': provisional, 'motivos': motivos, 'bloqueos': bloqueos,
            'revision_it_obligatoria': revision_it, 'nombre': info.get('nombre', ''),
            'quien': info.get('quien', ''), 'controles': info.get('controles', [])}


def escribir(res):
    e = lib.estado()
    if e is None:
        print('No hay docs/ESTADO.json. Ejecuta antes: python scripts/estado.py init ...')
        return 1
    e['nivel_riesgo'] = res['nivel']
    e['nivel_provisional'] = res['provisional']
    if not res['provisional']:
        e['nivel_max'] = max(e.get('nivel_max') or 0, res['nivel'])
    lib.guardar_json(lib.ruta('docs', 'ESTADO.json'), e)
    return 0


def main():
    res = clasificar(lib.leer_ficha())
    print('NIVEL DE RIESGO: %d%s - %s' % (res['nivel'], ' (provisional)' if res['provisional'] else '', res['nombre']))
    print('Quien la construye: ' + res['quien'])
    for m in res['motivos']:
        print('  motivo: ' + m)
    for c in res['controles']:
        print('  control: ' + c)
    for b in res['bloqueos']:
        print('BLOQUEO: ' + b)
    if '--escribir' in sys.argv:
        if escribir(res):
            sys.exit(1)
        print('Nivel guardado en docs/ESTADO.json')
    sys.exit(1 if res['bloqueos'] else 0)


if __name__ == '__main__':
    main()
