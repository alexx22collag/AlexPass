"""Utilidades comunes de los tests. Solo datos ficticios (@example.com, contrasenas inventadas)."""
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src'))

MAESTRA = 'Maestra-Ficticia-1'
USUARIO1 = 'usuario1@example.com'
USUARIO2 = 'usuario2@example.com'


class RelojFalso:
    """Reloj controlable: los tests avanzan el tiempo sin esperar."""

    def __init__(self):
        self._t = datetime(2026, 1, 15, 9, 0, 0)

    def ahora(self):
        return self._t

    def avanzar(self, **kw):
        self._t += timedelta(**kw)


class BaseTest(unittest.TestCase):
    def setUp(self):
        from gestor.adaptadores import AlmacenMemoria, SSOFalso
        from gestor.aplicacion import Aplicacion
        self.reloj = RelojFalso()
        self.almacen = AlmacenMemoria()
        self.sso = SSOFalso({'token-1': USUARIO1, 'token-2': USUARIO2})
        self.app = Aplicacion(almacen=self.almacen, sso=self.sso, reloj=self.reloj)
        self.sesion = self.app.iniciar_sesion('token-1')
        self.caja = self.app.crear_caja(self.sesion, MAESTRA)

    def anadir(self, sitio='Sitio Ejemplo', usuario='yo@example.com', contrasena='Ficticia-Aa1!xx', dias=90, tipo='Otro'):
        return self.caja.guardar(sitio, usuario, contrasena, dias, tipo=tipo)
