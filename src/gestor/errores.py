"""Errores de la app. Los mensajes son para el usuario: sin detalles internos."""


class AccesoDenegado(Exception):
    """Sin sesion SSO, sin caja abierta o con credenciales incorrectas."""


class DatoInvalido(ValueError):
    """Un dato introducido no es valido."""


class LimiteExcedido(Exception):
    """Se supera el maximo de cambios permitidos en una sola operacion."""


class DeshacerNoDisponible(Exception):
    """No hay nada que deshacer o ya pasaron los 20 segundos."""
