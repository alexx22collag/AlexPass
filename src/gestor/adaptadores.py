"""Adaptadores: lo que IT sustituye al conectar la app de verdad.

- Almacen: donde viven los datos (aqui, en memoria; solo guarda texto cifrado y metadatos).
- SSO: quien es el usuario (aqui, una tabla ficticia token -> usuario).
Las implementaciones reales leen su configuracion de variables de entorno (ver .env.example),
nunca de valores escritos en el codigo.
"""
import copy
import json


class AlmacenMemoria:
    """Almacen ficticio. Cada usuario tiene un registro con su caja cifrada, su registro y su baja."""

    def __init__(self):
        self._registros = {}

    def obtener(self, usuario):
        r = self._registros.get(usuario)
        return copy.deepcopy(r) if r is not None else None

    def guardar(self, usuario, registro):
        self._registros[usuario] = copy.deepcopy(registro)

    def borrar(self, usuario):
        self._registros.pop(usuario, None)

    def usuarios(self):
        return list(self._registros)

    def existe_caja(self, usuario):
        r = self._registros.get(usuario)
        return bool(r and r.get('caja'))

    def volcado(self):
        """Todo lo almacenado, tal cual (los tests comprueban que no hay nada en claro)."""
        return json.dumps(self._registros, default=str, sort_keys=True).encode('utf-8')


class SSOFalso:
    """SSO ficticio: `tokens` es un diccionario {token: usuario}. IT lo sustituye por el SSO real."""

    def __init__(self, tokens):
        self._tokens = dict(tokens)

    def validar(self, token):
        """Devuelve el usuario del token o None si no es valido."""
        return self._tokens.get(token)
