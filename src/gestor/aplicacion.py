"""Logica de la app: sesion SSO, caja cifrada y operaciones sobre las contraseñas.

Flujo: iniciar_sesion (SSO) -> crear_caja / abrir_caja (contraseña maestra o clave de emergencia).
Sin las dos cosas no se puede leer nada. Nunca se guarda la contraseña maestra.
Nivel 2: renovar varias es en seco por defecto, tiene tope y todo queda en el registro.
"""
import base64
import json
import secrets
import string
from dataclasses import dataclass
from datetime import date, timedelta

from . import cripto, exportar
from .errores import AccesoDenegado, DatoInvalido, DeshacerNoDisponible, LimiteExcedido

LIMITE_RENOVAR = 15          # maximo de cambios en una renovacion multiple (C24)
SEGUNDOS_DESHACER = 20       # margen para deshacer (C25)
DIAS_ANTERIOR = 5            # cuanto se conserva la contraseña anterior sin confirmar (C16)
DIAS_BAJA = 30               # cuanto se conserva la caja tras la baja (C19)
DIAS_REGISTRO = 365          # cuanto se conserva el registro de acciones (C26)
SEGUNDOS_PORTAPAPELES = 30   # el portapapeles se borra a los 30 s (C8)
AVISO_POR_DEFECTO = 7        # dias de antelacion del aviso (C2)
MIN_LONGITUD = 12
LONGITUD_POR_DEFECTO = 20
MIN_MAESTRA = 12
MENSAJE_VACIO = 'Aún no tienes contraseñas guardadas'

TIPOS_CARACTER = {
    'minusculas': string.ascii_lowercase,
    'mayusculas': string.ascii_uppercase,
    'digitos': string.digits,
    'simbolos': '!@#$%^&*()-_=+[]{}:,.?',
}
ALFABETO_EMERGENCIA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # sin 0/O/1/I para leerla en papel


def _a64(b):
    return base64.b64encode(b).decode('ascii')


def _de64(s):
    return base64.b64decode(s.encode('ascii'))


def _norm_clave(clave):
    return str(clave).replace('-', '').replace(' ', '').upper()


@dataclass(frozen=True)
class Sesion:
    usuario: str


@dataclass(frozen=True)
class Entrada:
    """Lo que se ve en la lista. A proposito no incluye la contraseña (C8)."""
    id: str
    sitio: str
    usuario: str
    tipo: str
    caduca: date
    estado: str          # Vigente | Por caducar | Caducada | Revisar
    aviso_dias: int


@dataclass(frozen=True)
class Aviso:
    id: str
    sitio: str
    motivo: str          # caducada | proxima


@dataclass(frozen=True)
class AvisoDuplicado:
    tipo: str            # contrasena_repetida | usuario_repetido
    sitios: list


@dataclass(frozen=True)
class Informe:
    cambios: int
    aplicado: bool


class Portapapeles:
    """Portapapeles simulado: lo copiado se borra a los 30 segundos."""

    def __init__(self, reloj):
        self._reloj = reloj
        self._texto = ''
        self._expira = None

    def copiar(self, texto):
        self._texto = texto
        self._expira = self._reloj.ahora() + timedelta(seconds=SEGUNDOS_PORTAPAPELES)

    def contenido(self):
        if self._expira is not None and self._reloj.ahora() >= self._expira:
            self._texto, self._expira = '', None
        return self._texto


class Aplicacion:
    def __init__(self, almacen, sso, reloj):
        self.almacen = almacen
        self._sso = sso
        self.reloj = reloj
        self.portapapeles = Portapapeles(reloj)

    # ---------- registro de acciones (nunca contraseñas) ----------
    def _registro_de(self, usuario):
        return self.almacen.obtener(usuario) or {'caja': None, 'registro': [], 'baja': None}

    def _anotar(self, usuario, accion, detalle=''):
        rec = self._registro_de(usuario)
        rec['registro'].append({'accion': accion, 'fecha': self.reloj.ahora(), 'detalle': detalle})
        self.almacen.guardar(usuario, rec)

    def _registro_vigente(self, usuario):
        """Registro del usuario sin lo que supera los 12 meses (C26)."""
        rec = self._registro_de(usuario)
        limite = self.reloj.ahora() - timedelta(days=DIAS_REGISTRO)
        vigente = [r for r in rec['registro'] if r['fecha'] >= limite]
        if len(vigente) != len(rec['registro']):
            rec['registro'] = vigente
            self.almacen.guardar(usuario, rec)
        return vigente

    def leer_registro(self, sesion, usuario):
        """Solo el dueño ve su registro."""
        if sesion.usuario != usuario:
            raise AccesoDenegado('No puedes ver el registro de otra persona.')
        return list(self._registro_vigente(usuario))

    # ---------- sesion y caja ----------
    def iniciar_sesion(self, token):
        usuario = self._sso.validar(token)
        if not usuario:
            raise AccesoDenegado('No se pudo iniciar sesión.')
        self._anotar(usuario, 'inicio_sesion')
        return Sesion(usuario)

    def crear_caja(self, sesion, maestra):
        rec = self._registro_de(sesion.usuario)
        if rec.get('caja'):
            raise DatoInvalido('Ya tienes una caja creada.')
        if len(maestra or '') < MIN_MAESTRA:
            raise DatoInvalido('La contraseña maestra debe tener al menos %d caracteres.' % MIN_MAESTRA)
        sal = secrets.token_bytes(16)
        k = secrets.token_bytes(32)
        caja = {'sal': _a64(sal), 'k_maestra': _a64(cripto.cifrar(cripto.derivar(maestra, sal), k)),
                'sal_emergencia': None, 'k_emergencia': None,
                'datos': _a64(cripto.cifrar(cripto.claves_de(k), json.dumps({'entradas': {}, 'n': 0}).encode()))}
        rec['caja'] = caja
        self.almacen.guardar(sesion.usuario, rec)
        self._anotar(sesion.usuario, 'caja_creada')
        return Caja(self, sesion.usuario, caja, k)

    def _caja_de(self, sesion):
        rec = self.almacen.obtener(sesion.usuario)
        if not rec or not rec.get('caja') or rec.get('baja'):
            raise AccesoDenegado('No se pudo abrir la caja.')
        return rec['caja']

    def abrir_caja(self, sesion, maestra):
        caja = self._caja_de(sesion)
        try:
            k = cripto.descifrar(cripto.derivar(maestra, _de64(caja['sal'])), _de64(caja['k_maestra']))
        except ValueError:
            raise AccesoDenegado('No se pudo abrir la caja.')
        self._anotar(sesion.usuario, 'caja_abierta')
        return Caja(self, sesion.usuario, caja, k)

    def abrir_caja_emergencia(self, sesion, clave):
        caja = self._caja_de(sesion)
        if not caja.get('k_emergencia'):
            raise AccesoDenegado('No se pudo abrir la caja.')
        try:
            claves = cripto.derivar(_norm_clave(clave), _de64(caja['sal_emergencia']))
            k = cripto.descifrar(claves, _de64(caja['k_emergencia']))
        except ValueError:
            raise AccesoDenegado('No se pudo abrir la caja.')
        self._anotar(sesion.usuario, 'caja_abierta_emergencia')
        return Caja(self, sesion.usuario, caja, k)

    # ---------- baja ----------
    def dar_de_baja(self, sesion):
        rec = self._registro_de(sesion.usuario)
        rec['baja'] = self.reloj.ahora()
        self.almacen.guardar(sesion.usuario, rec)
        self._anotar(sesion.usuario, 'baja')

    def purgar_bajas(self):
        """Borra las cajas cuya baja supera los 30 dias. Lo lanza una tarea programada."""
        for usuario in self.almacen.usuarios():
            baja = self._registro_de(usuario).get('baja')
            if baja and self.reloj.ahora() - baja >= timedelta(days=DIAS_BAJA):
                self.almacen.borrar(usuario)


class Caja:
    """Caja abierta de un usuario. Todo se cifra con la clave de datos antes de guardarse."""

    def __init__(self, app, usuario, caja, k):
        self._app = app
        self._usuario = usuario
        self._caja = caja
        self._k = k
        self._datos = json.loads(cripto.descifrar(cripto.claves_de(k), _de64(caja['datos'])))
        self._deshacer = None
        self._abierta = True
        self.emergencia_pendiente = False

    # ---------- interno ----------
    def _ok(self):
        if not self._abierta:
            raise AccesoDenegado('La caja está cerrada.')

    def _guardar(self):
        self._caja['datos'] = _a64(cripto.cifrar(cripto.claves_de(self._k), json.dumps(self._datos).encode()))
        rec = self._app._registro_de(self._usuario)
        rec['caja'] = self._caja
        self._app.almacen.guardar(self._usuario, rec)

    def _hoy(self):
        return self._app.reloj.ahora().date()

    def _entrada(self, ident):
        e = self._datos['entradas'].get(ident)
        if e is None:
            raise DatoInvalido('No existe esa entrada.')
        return e

    def _estado(self, e):
        if e['revisar']:
            return 'Revisar'
        caduca = date.fromisoformat(e['caduca'])
        if caduca < self._hoy():
            return 'Caducada'
        if (caduca - self._hoy()).days <= e['aviso']:
            return 'Por caducar'
        return 'Vigente'

    def _publica(self, e):
        return Entrada(e['id'], e['sitio'], e['usuario'], e['tipo'], date.fromisoformat(e['caduca']),
                       self._estado(e), e['aviso'])

    def _anotar(self, accion, detalle=''):
        self._app._anotar(self._usuario, accion, detalle)

    def cerrar(self):
        self._abierta = False
        self._datos = None
        self._k = None

    # ---------- C1, C12: guardar, editar, borrar ----------
    def guardar(self, sitio, usuario, contrasena, caduca_dias, tipo='Otro'):
        self._ok()
        if not sitio or not usuario or not contrasena:
            raise DatoInvalido('Sitio, usuario y contraseña son obligatorios.')
        if not isinstance(caduca_dias, int):
            raise DatoInvalido('La caducidad debe ser un número de días.')
        self._datos['n'] += 1
        ident = 'e%d' % self._datos['n']
        self._datos['entradas'][ident] = {
            'id': ident, 'sitio': sitio, 'usuario': usuario, 'contrasena': contrasena, 'tipo': tipo or 'Otro',
            'dias': caduca_dias, 'caduca': (self._hoy() + timedelta(days=caduca_dias)).isoformat(),
            'revisar': caduca_dias <= 0,      # C15: fecha imposible -> se guarda y se marca
            'aviso': AVISO_POR_DEFECTO, 'anterior': None, 'anterior_hasta': None}
        self._guardar()
        self._anotar('alta', ident)
        return self._publica(self._datos['entradas'][ident])

    def actualizar(self, ident, sitio=None, usuario=None, contrasena=None, tipo=None, caduca_dias=None):
        self._ok()
        e = self._entrada(ident)
        if contrasena is not None:   # guarda lo anterior para poder deshacer 20 s (C4)
            self._deshacer = (ident, dict(e), self._app.reloj.ahora() + timedelta(seconds=SEGUNDOS_DESHACER))
        for campo, valor in (('sitio', sitio), ('usuario', usuario), ('contrasena', contrasena), ('tipo', tipo)):
            if valor is not None:
                if valor == '':
                    raise DatoInvalido('El campo %s no puede quedar vacío.' % campo)
                e[campo] = valor
        if caduca_dias is not None:
            e['dias'] = caduca_dias
            e['caduca'] = (self._hoy() + timedelta(days=caduca_dias)).isoformat()
            e['revisar'] = caduca_dias <= 0
        self._guardar()
        self._anotar('cambio', ident)
        return self._publica(e)

    def borrar(self, ident):
        self._ok()
        self._entrada(ident)
        del self._datos['entradas'][ident]
        self._guardar()
        self._anotar('borrado', ident)

    # ---------- C4, C25: deshacer ----------
    def deshacer(self):
        self._ok()
        if not self._deshacer or self._app.reloj.ahora() > self._deshacer[2]:
            raise DeshacerNoDisponible('Ya no se puede deshacer.')
        ident, anterior, _ = self._deshacer
        self._datos['entradas'][ident] = anterior
        self._deshacer = None
        self._guardar()
        self._anotar('deshacer', ident)

    # ---------- C9: listar, buscar, filtrar ----------
    def listar(self, buscar=None, estado=None):
        self._ok()
        resultado = []
        for e in self._datos['entradas'].values():
            if buscar and buscar.lower() not in e['sitio'].lower() and buscar.lower() not in e['usuario'].lower():
                continue
            p = self._publica(e)
            if estado and p.estado != estado:
                continue
            resultado.append(p)
        return sorted(resultado, key=lambda x: (x.caduca, x.sitio))

    def mensaje_vacio(self):
        return MENSAJE_VACIO

    # ---------- C8: ver y copiar ----------
    def ver(self, ident):
        self._ok()
        contrasena = self._entrada(ident)['contrasena']
        self._anotar('ver_contrasena', ident)
        return contrasena

    def copiar(self, ident):
        self._ok()
        self._app.portapapeles.copiar(self._entrada(ident)['contrasena'])
        self._anotar('copiar_contrasena', ident)

    # ---------- C2: avisos ----------
    def programar_aviso(self, ident, dias):
        self._ok()
        if not isinstance(dias, int) or not 0 <= dias <= 365:
            raise DatoInvalido('La antelación debe estar entre 0 y 365 días.')
        self._entrada(ident)['aviso'] = dias
        self._guardar()

    def avisos(self):
        self._ok()
        motivos = {'Caducada': 'caducada', 'Por caducar': 'proxima'}
        return [Aviso(e.id, e.sitio, motivos[e.estado]) for e in self.listar() if e.estado in motivos]

    # ---------- C17: duplicados ----------
    def avisos_duplicados(self):
        self._ok()
        entradas = list(self._datos['entradas'].values())
        avisos = []
        por_clave = {}
        for e in entradas:
            por_clave.setdefault(e['contrasena'], []).append(e['sitio'])
        avisos += [AvisoDuplicado('contrasena_repetida', sitios) for sitios in por_clave.values() if len(sitios) > 1]
        por_usuario = {}
        for e in entradas:
            por_usuario.setdefault((e['sitio'].lower(), e['usuario'].lower()), []).append(e['sitio'])
        avisos += [AvisoDuplicado('usuario_repetido', sitios) for sitios in por_usuario.values() if len(sitios) > 1]
        return avisos

    # ---------- C3: generar ----------
    def generar(self, longitud=LONGITUD_POR_DEFECTO, tipos=('minusculas', 'mayusculas', 'digitos', 'simbolos')):
        self._ok()
        if not isinstance(longitud, int) or not MIN_LONGITUD <= longitud <= 128:
            raise DatoInvalido('La longitud debe estar entre %d y 128.' % MIN_LONGITUD)
        if not tipos or any(t not in TIPOS_CARACTER for t in tipos):
            raise DatoInvalido('Tipos de carácter no válidos.')
        todos = ''.join(TIPOS_CARACTER[t] for t in tipos)
        caracteres = [secrets.choice(TIPOS_CARACTER[t]) for t in tipos]   # al menos uno de cada tipo
        caracteres += [secrets.choice(todos) for _ in range(longitud - len(caracteres))]
        secrets.SystemRandom().shuffle(caracteres)
        return ''.join(caracteres)

    # ---------- C16: renovar ----------
    def renovar(self, ident, nueva):
        self._ok()
        e = self._entrada(ident)
        if not nueva:
            raise DatoInvalido('La nueva contraseña no puede estar vacía.')
        e['anterior'] = e['contrasena']
        e['anterior_hasta'] = (self._app.reloj.ahora() + timedelta(days=DIAS_ANTERIOR)).isoformat()
        e['contrasena'] = nueva
        if e['dias'] > 0:
            e['caduca'] = (self._hoy() + timedelta(days=e['dias'])).isoformat()
        self._guardar()
        self._anotar('renovacion', ident)

    def contrasena_anterior(self, ident):
        self._ok()
        e = self._entrada(ident)
        if e['anterior'] is None:
            return None
        if self._app.reloj.ahora().isoformat() >= e['anterior_hasta']:   # pasaron 5 dias sin confirmar
            e['anterior'] = e['anterior_hasta'] = None
            self._guardar()
            return None
        return e['anterior']

    def confirmar_renovacion(self, ident):
        self._ok()
        e = self._entrada(ident)
        e['anterior'] = e['anterior_hasta'] = None
        self._guardar()
        self._anotar('renovacion_confirmada', ident)

    # ---------- C10, C24: renovar varias (nivel 2: en seco, tope, confirmacion) ----------
    def renovar_varias(self, ids, confirmar=False):
        self._ok()
        ids = list(ids)
        if len(ids) > LIMITE_RENOVAR:
            raise LimiteExcedido('Se pueden renovar como máximo %d a la vez.' % LIMITE_RENOVAR)
        for i in ids:
            self._entrada(i)
        if not confirmar:
            self._anotar('prueba_en_seco', '%d' % len(ids))
            return Informe(len(ids), False)
        for i in ids:
            self.renovar(i, self.generar())
        return Informe(len(ids), True)

    # ---------- C6, C18: clave de emergencia ----------
    def generar_clave_emergencia(self):
        """Devuelve la clave una sola vez. La anterior deja de valer. Nunca se envía por correo."""
        self._ok()
        clave = ''.join(secrets.choice(ALFABETO_EMERGENCIA) for _ in range(24))
        sal = secrets.token_bytes(16)
        self._caja['sal_emergencia'] = _a64(sal)
        self._caja['k_emergencia'] = _a64(cripto.cifrar(cripto.derivar(clave, sal), self._k))
        self._guardar()
        self.emergencia_pendiente = True
        self._anotar('clave_emergencia_generada')
        return '-'.join(clave[i:i + 4] for i in range(0, 24, 4))

    def confirmar_clave_emergencia(self):
        self._ok()
        self.emergencia_pendiente = False
        self._anotar('clave_emergencia_confirmada')

    # ---------- C5, C7, C23: exportaciones sin contraseñas ----------
    def exportar_excel(self):
        self._ok()
        filas = [(e.sitio, e.usuario, e.tipo, e.caduca.isoformat()) for e in self.listar()]
        self._anotar('exportacion', 'excel')
        return exportar.a_excel(filas)

    def exportar_ics(self):
        self._ok()
        eventos = [(e.id, e.sitio, e.caduca) for e in self.listar()]
        self._anotar('exportacion', 'calendario')
        return exportar.a_ics(eventos, self._app.reloj.ahora())

    # ---------- C11, C26 ----------
    def registro(self):
        self._ok()
        return self._app.leer_registro(Sesion(self._usuario), self._usuario)
