#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Maquina de estados de la app. Las puertas (gates) las decide este script, no Claude.

Uso:
  python scripts/estado.py init --app NOMBRE --propietario NOMBRE
  python scripts/estado.py status | check | advance
  python scripts/estado.py frase                      # frase exacta que debe escribir el usuario para aprobar
  python scripts/estado.py aprobar --nombre N --frase "APRUEBO REQUISITOS xxxxxxxx"
  python scripts/estado.py cambio-alcance --motivo "..."
  python scripts/estado.py registrar-huecos | iteracion-maqueta
  python scripts/estado.py registrar-pr --url URL
  python scripts/estado.py verificar-todo             # lo usa el pipeline
  (solo IT, con IT_ADMIN=1: aprobar-it, confirmar-descenso)
"""
import argparse
import datetime
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import check_dependencias
import check_estructura
import clasificar_riesgo
import ejecutar_tests
import lib
import scan_secretos
import trazabilidad

FASES = ['r1', 'r2', 'r3', 'build', 'verify', 'publish', 'done']
SIGUIENTE = dict(zip(FASES, FASES[1:]))
NOMBRE_FASE = {'r1': 'Ronda 1: entrevista nucleo y maqueta', 'r2': 'Ronda 2: seguimiento y huecos',
               'r3': 'Ronda 3: cierre y requisitos', 'build': 'Construccion', 'verify': 'Verificacion',
               'publish': 'Publicacion', 'done': 'Entregada a revision de IT'}
ACCION = {
    'r1': 'entrevista (ronda 1) -> clasificar-riesgo -> maqueta-visual -> estado.py advance',
    'r2': 'entrevista (ronda 2) -> revision-huecos -> estado.py advance',
    'r3': 'entrevista (ronda 3) -> generar-criterios-y-tests (requisitos y criterios) -> aprobacion del usuario -> estado.py advance',
    'build': 'generar-criterios-y-tests (tests en rojo) -> construir-app -> estado.py advance',
    'verify': 'prueba-guiada -> revision-seguridad -> ficha-mantenimiento -> verificacion -> estado.py advance',
    'publish': 'publicar-repo -> estado.py registrar-pr',
    'done': 'Nada mas. IT revisa la solicitud de revision.',
}
REQ_TITULOS = ['## Problema', '## Alcance', '## Fuera de alcance (v2)', '## Usuarios y roles',
               '## Datos y conexiones', '## Nivel de riesgo']


def _leer(p):
    return p.read_text(encoding='utf-8-sig') if p.exists() else ''


def _estado():
    e = lib.estado()
    if e is None:
        print('No hay docs/ESTADO.json. Ejecuta: python scripts/estado.py init --app NOMBRE --propietario NOMBRE')
        sys.exit(1)
    return e


def _guardar(e):
    lib.guardar_json(lib.ruta('docs', 'ESTADO.json'), e)
    ap = e.get('aprobacion_usuario')
    lineas = ['# Estado de la app (lo escribe estado.py, no se edita a mano)', '',
              '- App: %s' % e.get('app'), '- Propietario: %s' % e.get('propietario'),
              '- Fase: %s (%s)' % (e.get('fase'), NOMBRE_FASE.get(e.get('fase'), '')),
              '- Nivel de riesgo: %s%s' % (e.get('nivel_riesgo'), ' (provisional)' if e.get('nivel_provisional') else ''),
              '- Rondas de cambios de alcance: %s' % e.get('rondas_cambios', 0),
              '- Aprobacion del usuario: %s' % ('%s el %s' % (ap['por'], ap['fecha']) if ap else 'pendiente'),
              '- Solicitud de revision: %s' % (e.get('pr_url') or 'sin abrir'), '', '## Historial']
    for h in e.get('historial', []):
        lineas.append('- %s: %s' % (h['fecha'], h['evento']))
    (lib.ruta('docs') / 'ESTADO.md').write_text('\n'.join(lineas) + '\n', encoding='utf-8', newline='\n')


def _hist(e, evento):
    e.setdefault('historial', []).append({'fecha': lib.ahora(), 'evento': evento})


def _marcas(texto, patron):
    return re.findall(patron, texto, re.M)


# ---------------------------------------------------------------- puertas
def _maqueta_ok():
    pol = lib.politica()
    marca = pol.get('maqueta_marca', 'MAQUETA')
    htmls = [p for p in lib.ficheros_de('maqueta') if p.suffix.lower() in ('.html', '.htm')]
    if not htmls:
        return False, 'No hay maqueta HTML en maqueta/'
    sin = [lib.rel(p) for p in htmls if marca not in p.read_text(encoding='utf-8', errors='ignore')]
    if sin:
        return False, 'Faltan el rotulo "%s" en: %s' % (marca, ', '.join(sin))
    return True, 'Maqueta con el rotulo "%s" visible' % marca


def gate_r1():
    f = lib.leer_ficha()
    e = lib.estado() or {}
    pol = lib.politica()
    r = []
    falt = lib.faltan(f, 'r1')
    r.append(('G1.1', not falt, 'Respuestas de la ronda 1 completas' if not falt else 'Faltan respuestas: ' + ', '.join(falt)))
    r.append(('G1.2', f.get('acceso_actual') != 'cuenta_compartida',
              'No se usa una cuenta compartida' if f.get('acceso_actual') != 'cuenta_compartida' else
              'R-05: no se puede usar una cuenta compartida. IT debe crear una identidad propia para la app.'))
    desconocidos = [k for k in lib.CLAVES_DATOS if f.get(k) == 'no_se']
    if desconocidos:
        ok = f.get('estado_it_datos') == 'pendiente_it' and lib.consulta_it() is not None
        r.append(('G1.3', ok, 'Hay datos por confirmar (%s) y consta la consulta a IT' % ', '.join(desconocidos) if ok else
                  'Hay respuestas no_se (%s). Usa la skill preguntar-a-it para generar la consulta a IT' % ', '.join(desconocidos)))
    fresco = clasificar_riesgo.clasificar(f)
    ok_nivel = e.get('nivel_riesgo') == fresco['nivel'] and bool(e.get('nivel_provisional')) == fresco['provisional']
    r.append(('G1.4', ok_nivel, 'Nivel de riesgo calculado y guardado: %s%s' % (fresco['nivel'], ' (provisional)' if fresco['provisional'] else '') if ok_nivel else
              'El nivel guardado no coincide con la ficha. Ejecuta: python scripts/clasificar_riesgo.py --escribir'))
    ok_m, msg_m = _maqueta_ok()
    r.append(('G1.5', ok_m, msg_m))
    soportados = pol.get('formatos_soportados', [])
    fmt = f.get('formato')
    r.append(('G1.6', (not fmt) or (fmt in soportados), 'Formato soportado por la plantilla de IT' if (not fmt) or (fmt in soportados) else
              'El formato "%s" no lo soporta la plantilla de IT (soportados: %s). Hay que elegir uno soportado.' % (fmt, ', '.join(soportados))))
    return r


def gate_r2():
    f = lib.leer_ficha()
    e = lib.estado() or {}
    pol = lib.politica()
    r = []
    falt = lib.faltan(f, 'r2')
    r.append(('G2.1', not falt, 'Respuestas de la ronda 2 completas' if not falt else 'Faltan respuestas: ' + ', '.join(falt)))
    p = e.get('pasadas_huecos', 0)
    r.append(('G2.2', p >= 1, 'revision-huecos ejecutada %d vez/veces (maximo %d)' % (p, pol.get('pasadas_huecos_max', 2)) if p >= 1 else
              'Falta ejecutar la skill revision-huecos y registrarla (estado.py registrar-huecos)'))
    h = lib.ruta('docs', 'huecos.md')
    abiertos = _marcas(_leer(h), r'^\s*-\s*\[ \]\s*(.*)$') if h.exists() else None
    if abiertos is None:
        r.append(('G2.3', False, 'No existe docs/huecos.md (lo genera revision-huecos)'))
    else:
        r.append(('G2.3', not abiertos, 'No quedan huecos abiertos' if not abiertos else
                  'Quedan %d huecos abiertos en docs/huecos.md: resuelvelos o marcalos [v2]' % len(abiertos)))
    return r


def _aprobacion_vigente(e):
    ap = e.get('aprobacion_usuario')
    if not ap:
        return False, 'Falta la aprobacion del usuario (estado.py frase / aprobar)'
    if ap.get('hash') != lib.hash_aprobacion():
        return False, 'Los requisitos o criterios han cambiado desde que el usuario los aprobo (R-15). Hay que reaprobarlos.'
    return True, 'Requisitos y criterios aprobados por %s' % ap.get('por')


def gate_r3(con_aprobacion=True):
    f = lib.leer_ficha()
    e = lib.estado() or {}
    r = []
    falt = lib.faltan(f, 'r3')
    r.append(('G3.1', not falt, 'Respuestas de la ronda 3 completas' if not falt else 'Faltan respuestas: ' + ', '.join(falt)))
    r.append(('G3.2', f.get('estado_it_datos') == 'resuelto', 'Origen y permisos de los datos confirmados' if f.get('estado_it_datos') == 'resuelto' else
              'R-04: los datos siguen pendientes de IT (estado_it_datos = %s). No se construye sin confirmarlos.' % (f.get('estado_it_datos') or 'sin definir')))
    fresco = clasificar_riesgo.clasificar(f)
    r.append(('G3.3', not fresco['provisional'], 'El nivel de riesgo ya no es provisional' if not fresco['provisional'] else
              'El nivel de riesgo es provisional por respuestas no_se'))
    r.append(('G3.4', fresco['nivel'] < 3 and not fresco['bloqueos'], 'El nivel permite que la construya el usuario' if fresco['nivel'] < 3 and not fresco['bloqueos'] else
              'R-07: nivel 3 o bloqueo de seguridad. Esta app la construye solo IT.'))
    desc = (e.get('nivel_max') or 0) > (e.get('nivel_riesgo') or 0) and not e.get('descenso_confirmado_it')
    r.append(('G3.5', not desc, 'El nivel de riesgo no ha bajado sin confirmar' if not desc else
              'R-06: el nivel ha bajado de %s a %s. Solo IT puede confirmarlo.' % (e.get('nivel_max'), e.get('nivel_riesgo'))))
    req = _leer(lib.ruta('docs', 'REQUISITOS.md'))
    faltan_t = [t for t in REQ_TITULOS if t not in req]
    r.append(('G3.6', bool(req) and not faltan_t, 'REQUISITOS.md con todos los apartados' if req and not faltan_t else
              'REQUISITOS.md incompleto. Faltan apartados: ' + ', '.join(faltan_t or REQ_TITULOS)))
    r += trazabilidad.comprobar_criterios()
    if con_aprobacion:
        ok, msg = _aprobacion_vigente(e)
        r.append(('G3.7', ok, msg))
        if fresco['nivel'] >= 2:
            aprobado_it = bool(e.get('aprobacion_it_requisitos')) and e['aprobacion_it_requisitos'].get('hash') == lib.hash_aprobacion()
            r.append(('G3.8', aprobado_it, 'IT ha aprobado los requisitos (nivel %d)' % fresco['nivel'] if aprobado_it else
                      'R-07: nivel %d: IT debe aprobar los requisitos antes de construir' % fresco['nivel']))
    return r


def gate_build():
    e = lib.estado() or {}
    r = []
    src, tst = lib.ficheros_de('src'), lib.ficheros_de('tests')
    r.append(('B1', bool(src), 'Hay codigo en src/' if src else 'No hay codigo en src/'))
    r.append(('B2', bool(tst), 'Hay tests en tests/' if tst else 'No hay tests en tests/'))
    r += trazabilidad.comprobar()
    r += ejecutar_tests.comprobar_rojo()
    r += ejecutar_tests.comprobar_fresco()
    r += scan_secretos.comprobar()
    r += check_dependencias.comprobar()
    r += check_estructura.comprobar()
    ok, msg = _aprobacion_vigente(e)
    r.append(('B3', ok, msg))
    return r


def _checklist(path, patron_id):
    t = _leer(path)
    hechos = re.findall(r'^\s*-\s*\[[xX]\]\s*(%s)\b' % patron_id, t, re.M)
    pendientes = re.findall(r'^\s*-\s*\[ \]\s*(%s)\b' % patron_id, t, re.M)
    na = re.findall(r'^\s*-\s*\[n/a\]\s*(%s)\b(.*)$' % patron_id, t, re.M)
    return t, hechos, pendientes, na


def gate_verify():
    f = lib.leer_ficha()
    pol = lib.politica()
    r = gate_build()
    # prueba guiada
    t, hechos, pend, _ = _checklist(lib.ruta('docs', 'VERIFICACION.md'), r'P\d+')
    minimo = pol.get('prueba_guiada_minimos', 3)
    r.append(('V1', len(hechos) >= minimo and not pend, 'Prueba guiada completada (%d puntos)' % len(hechos) if len(hechos) >= minimo and not pend else
              'Prueba guiada incompleta: %d puntos hechos (minimo %d), %d sin marcar' % (len(hechos), minimo, len(pend))))
    # seguridad
    ts, hechos_s, pend_s, na = _checklist(lib.ruta('docs', 'SEGURIDAD.md'), r'S\d+')
    ids = pol.get('seguridad_ids', [])
    no_na = set(pol.get('seguridad_no_na', []))
    if f.get('roles_distintos') == 'si':
        no_na.add('S04')
    if f.get('lee_modifica') == 'modifica':
        no_na.add('S14')
    resueltos = set(hechos_s) | {x[0] for x in na if len(x[1].strip()) >= 10}
    sin = [i for i in ids if i not in resueltos]
    mal_na = [x[0] for x in na if x[0] in no_na or len(x[1].strip()) < 10]
    r.append(('V2', not sin and not mal_na and not pend_s, 'Checklist de seguridad completo' if not sin and not mal_na and not pend_s else
              'R-03/R-14: checklist de seguridad incompleto. Sin resolver: %s. No admiten n/a o sin motivo: %s' % (', '.join(sin) or '-', ', '.join(mal_na) or '-')))
    # mantenimiento
    m = lib.ruta('docs', 'MANTENIMIENTO.md')
    tm = _leer(m)
    kv = {k.strip(): v.strip() for k, v in re.findall(r'^\s*([a-z_]+)\s*:\s*(.+)$', tm, re.M)}
    falt_m = [k for k in ('propietario', 'suplente', 'revision', 'retirada', 'aviso_fallos') if not kv.get(k) or '<' in kv.get(k, '')]
    fecha_ok = False
    try:
        d = datetime.date.fromisoformat(kv.get('revision', ''))
        fecha_ok = datetime.date.today() < d <= datetime.date.today() + datetime.timedelta(days=400)
    except ValueError:
        pass
    mismo = kv.get('propietario', '').strip().lower() == f.get('propietario', '').strip().lower() and bool(kv.get('propietario'))
    ok_m = not falt_m and fecha_ok and mismo
    r.append(('V3', ok_m, 'MANTENIMIENTO.md completo (propietario %s)' % kv.get('propietario') if ok_m else
              'R-14: MANTENIMIENTO.md incompleto. Faltan: %s%s%s' % (', '.join(falt_m) or '-',
                                                                     '' if fecha_ok else '; la fecha de revision debe ser futura y de menos de un ano',
                                                                     '' if mismo else '; el propietario debe coincidir con la ficha')))
    return r


def gate_publish():
    e = lib.estado() or {}
    ok = bool(e.get('pr_url'))
    return [('P1', ok, 'Solicitud de revision registrada: %s' % e.get('pr_url') if ok else 'Falta abrir la solicitud de revision y registrarla (estado.py registrar-pr --url ...)')]


GATES = {'r1': gate_r1, 'r2': gate_r2, 'r3': gate_r3, 'build': gate_build, 'verify': gate_verify, 'publish': gate_publish}


def imprimir(titulo, res):
    print(titulo)
    for cod, ok, msg in res:
        print('  [%s] %-6s %s' % ('OK' if ok else 'FALLA', cod, msg))
    todo = all(ok for _, ok, _ in res)
    print('RESULTADO: ' + ('PUERTA SUPERADA' if todo else 'PUERTA NO SUPERADA'))
    return todo


# ---------------------------------------------------------------- comandos
def cmd_init(a):
    if lib.estado() is not None:
        print('RECHAZADO: ya existe docs/ESTADO.json')
        return 1
    e = {'app': a.app, 'propietario': a.propietario, 'fase': 'r1', 'creada': lib.ahora(), 'nivel_riesgo': None,
         'nivel_provisional': False, 'nivel_max': 0, 'pasadas_huecos': 0, 'rondas_cambios': 0,
         'iteraciones_maqueta': 0, 'aprobacion_usuario': None, 'aprobacion_it_requisitos': None,
         'descenso_confirmado_it': False, 'pr_url': None, 'historial': []}
    _hist(e, 'App creada desde la plantilla')
    _guardar(e)
    print('OK: app "%s" creada. Fase: r1' % a.app)
    return 0


def cmd_status(avanzar=False):
    e = _estado()
    f = e['fase']
    print('ESTADO | app: %s | fase: %s (%s) | riesgo: %s%s' % (e['app'], f, NOMBRE_FASE[f], e.get('nivel_riesgo'),
                                                              ' (provisional)' if e.get('nivel_provisional') else ''))
    if f == 'done':
        print('Siguiente: ' + ACCION[f])
        return 0
    todo = imprimir('Puerta %s -> %s:' % (f, SIGUIENTE[f]), GATES[f]())
    print('Siguiente: ' + ACCION[f])
    if avanzar and todo and f != 'publish':
        e['fase'] = SIGUIENTE[f]
        _hist(e, 'Puerta %s superada. Nueva fase: %s' % (f, e['fase']))
        _guardar(e)
        print('AVANZADA: ahora en fase %s (%s)' % (e['fase'], NOMBRE_FASE[e['fase']]))
        return 0
    if avanzar and f == 'publish':
        print('La fase publish termina con: estado.py registrar-pr --url URL')
        return 1
    return 0 if todo else 1


def cmd_frase():
    e = _estado()
    if e['fase'] != 'r3':
        print('RECHAZADO: la aprobacion se pide en la fase r3 (ahora: %s)' % e['fase'])
        return 1
    res = gate_r3(con_aprobacion=False)
    if not all(ok for _, ok, _ in res):
        imprimir('Antes de pedir la aprobacion hay que cerrar esto:', res)
        return 1
    print('FRASE QUE DEBE ESCRIBIR EL USUARIO, TAL CUAL: APRUEBO REQUISITOS %s' % lib.hash_aprobacion()[:8])
    return 0


def cmd_aprobar(a):
    e = _estado()
    if e['fase'] != 'r3':
        print('RECHAZADO: solo se aprueba en la fase r3.')
        return 1
    res = gate_r3(con_aprobacion=False)
    if not all(ok for _, ok, _ in res):
        imprimir('No se puede aprobar todavia:', res)
        return 1
    esperada = 'APRUEBO REQUISITOS %s' % lib.hash_aprobacion()[:8]
    if (a.frase or '').strip() != esperada:
        print('RECHAZADO: la frase no coincide. Debe escribirla el usuario exactamente: ' + esperada)
        return 1
    e['aprobacion_usuario'] = {'por': a.nombre, 'frase': esperada, 'hash': lib.hash_aprobacion(), 'fecha': lib.ahora()}
    _hist(e, 'Requisitos y criterios aprobados por %s' % a.nombre)
    _guardar(e)
    print('OK: aprobacion registrada (%s).' % a.nombre)
    return 0


def _solo_it():
    if os.environ.get('IT_ADMIN') != '1':
        print('RECHAZADO (R-11): este comando es solo de IT (variable IT_ADMIN=1).')
        return False
    return True


def cmd_aprobar_it(a):
    if not _solo_it():
        return 1
    e = _estado()
    h = lib.hash_aprobacion()
    if not h:
        print('RECHAZADO: no hay requisitos y criterios que aprobar.')
        return 1
    e['aprobacion_it_requisitos'] = {'por': a.nombre, 'hash': h, 'fecha': lib.ahora()}
    _hist(e, 'IT aprueba los requisitos (%s)' % a.nombre)
    _guardar(e)
    print('OK: aprobacion de IT registrada.')
    return 0


def cmd_confirmar_descenso(a):
    if not _solo_it():
        return 1
    e = _estado()
    e['descenso_confirmado_it'] = True
    e['nivel_max'] = e.get('nivel_riesgo') or 0
    _hist(e, 'IT confirma el descenso de nivel (%s)' % a.nombre)
    _guardar(e)
    print('OK: descenso de nivel confirmado por IT.')
    return 0


def cmd_cambio_alcance(a):
    e = _estado()
    pol = lib.politica()
    if e['fase'] in ('r1', 'r2', 'r3'):
        print('No hace falta: aun estas en %s y los requisitos no estan aprobados.' % e['fase'])
        return 0
    maximo = pol.get('rondas_cambios_max', 3)
    if e.get('rondas_cambios', 0) + 1 > maximo:
        _hist(e, 'Cambio de alcance rechazado (tope de rondas): %s' % a.motivo)
        _guardar(e)
        print('RECHAZADO (R-15): ya se han hecho %d rondas de cambios. Lo nuevo va a la version 2.' % e.get('rondas_cambios', 0))
        return 1
    e['rondas_cambios'] = e.get('rondas_cambios', 0) + 1
    e['fase'] = 'r3'
    e['aprobacion_usuario'] = None
    e['aprobacion_it_requisitos'] = None
    for f in (ejecutar_tests.F_ROJO, ejecutar_tests.F_VERDE):
        p = lib.ruta(*f)
        if p.exists():
            p.unlink()
    _hist(e, 'Cambio de alcance (%d de %d): %s' % (e['rondas_cambios'], pol.get('rondas_cambios_max', 3), a.motivo))
    _guardar(e)
    print('OK: vuelves a la fase r3. Hay que actualizar requisitos y criterios, reaprobarlos y volver a ver los tests en rojo.')
    return 0


def cmd_registrar_huecos():
    e = _estado()
    pol = lib.politica()
    if e['fase'] not in ('r2', 'r3'):
        print('RECHAZADO: revision-huecos se usa en r2 o r3.')
        return 1
    if e.get('pasadas_huecos', 0) >= pol.get('pasadas_huecos_max', 2):
        print('RECHAZADO (R-15): ya se hicieron %d pasadas. Lo que siga abierto pasa a v2.' % e['pasadas_huecos'])
        return 1
    e['pasadas_huecos'] = e.get('pasadas_huecos', 0) + 1
    _hist(e, 'revision-huecos: pasada %d' % e['pasadas_huecos'])
    _guardar(e)
    print('OK: pasada %d de %d registrada.' % (e['pasadas_huecos'], pol.get('pasadas_huecos_max', 2)))
    return 0


def cmd_iteracion_maqueta():
    e = _estado()
    if e.get('iteraciones_maqueta', 0) >= 3:
        print('RECHAZADO: tope de 3 iteraciones de maqueta. Lo que falte va a la version 2 (ficha.py set v2 "...").')
        return 1
    e['iteraciones_maqueta'] = e.get('iteraciones_maqueta', 0) + 1
    _guardar(e)
    print('OK: iteracion %d de 3.' % e['iteraciones_maqueta'])
    return 0


def cmd_registrar_pr(a):
    e = _estado()
    if e['fase'] != 'publish':
        print('RECHAZADO: la solicitud de revision se registra en la fase publish (ahora: %s)' % e['fase'])
        return 1
    if not re.match(r'^https?://', a.url or ''):
        print('RECHAZADO: la URL de la solicitud de revision no es valida.')
        return 1
    e['pr_url'] = a.url
    e['fase'] = 'done'
    _hist(e, 'Solicitud de revision abierta: %s' % a.url)
    _guardar(e)
    print('OK: entregada a IT.')
    return 0


def verificar_todo():
    """Recalcula todas las puertas desde cero, sin fiarse de la fase guardada. Lo usa el pipeline."""
    ok_total = True
    for nombre, g in (('r1', gate_r1), ('r2', gate_r2), ('r3', gate_r3), ('verify', gate_verify)):
        ok_total &= imprimir('Puerta %s:' % nombre, g())
    return 0 if ok_total else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd')
    p = sub.add_parser('init')
    p.add_argument('--app', required=True)
    p.add_argument('--propietario', required=True)
    for c in ('status', 'check', 'advance', 'frase', 'registrar-huecos', 'iteracion-maqueta', 'verificar-todo'):
        sub.add_parser(c)
    p = sub.add_parser('aprobar')
    p.add_argument('--nombre', required=True)
    p.add_argument('--frase', required=True)
    p = sub.add_parser('aprobar-it')
    p.add_argument('--nombre', required=True)
    p = sub.add_parser('confirmar-descenso')
    p.add_argument('--nombre', required=True)
    p = sub.add_parser('cambio-alcance')
    p.add_argument('--motivo', required=True)
    p = sub.add_parser('registrar-pr')
    p.add_argument('--url', required=True)
    a = ap.parse_args()
    if a.cmd == 'init':
        sys.exit(cmd_init(a))
    if a.cmd in ('status', 'check'):
        sys.exit(cmd_status(False))
    if a.cmd == 'advance':
        sys.exit(cmd_status(True))
    if a.cmd == 'frase':
        sys.exit(cmd_frase())
    if a.cmd == 'aprobar':
        sys.exit(cmd_aprobar(a))
    if a.cmd == 'aprobar-it':
        sys.exit(cmd_aprobar_it(a))
    if a.cmd == 'confirmar-descenso':
        sys.exit(cmd_confirmar_descenso(a))
    if a.cmd == 'cambio-alcance':
        sys.exit(cmd_cambio_alcance(a))
    if a.cmd == 'registrar-huecos':
        sys.exit(cmd_registrar_huecos())
    if a.cmd == 'iteracion-maqueta':
        sys.exit(cmd_iteracion_maqueta())
    if a.cmd == 'registrar-pr':
        sys.exit(cmd_registrar_pr(a))
    if a.cmd == 'verificar-todo':
        sys.exit(verificar_todo())
    ap.print_help()
    sys.exit(2)


if __name__ == '__main__':
    main()
