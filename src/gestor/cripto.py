"""Cifrado con la libreria estandar (IT no ha aprobado ninguna libreria criptografica).

Esquema: clave derivada con scrypt; cifrado de flujo con HMAC-SHA256 en modo contador;
autenticacion encrypt-then-MAC con una segunda clave. Al fallar el MAC (clave incorrecta
o datos alterados) se lanza ValueError.
Si IT aprueba `python:cryptography`, solo hay que sustituir este fichero por AES-GCM.
"""
import hashlib
import hmac
import secrets

TAM_NONCE = 16
TAM_TAG = 32


def claves_de(k):
    """De una clave de 32 bytes saca la clave de cifrado y la de autenticacion."""
    return (hmac.new(k, b'enc', hashlib.sha256).digest(), hmac.new(k, b'mac', hashlib.sha256).digest())


def derivar(secreto, sal):
    """Deriva claves a partir de una contraseña o clave de emergencia (lento a proposito)."""
    k = hashlib.scrypt(secreto.encode('utf-8'), salt=sal, n=2 ** 14, r=8, p=1, dklen=32)
    return claves_de(k)


def _flujo(k_enc, nonce, n):
    salida = bytearray()
    contador = 0
    while len(salida) < n:
        salida += hmac.new(k_enc, nonce + contador.to_bytes(8, 'big'), hashlib.sha256).digest()
        contador += 1
    return bytes(salida[:n])


def _xor(a, b):
    return (int.from_bytes(a, 'big') ^ int.from_bytes(b, 'big')).to_bytes(len(a), 'big') if a else b''


def cifrar(claves, datos):
    k_enc, k_mac = claves
    nonce = secrets.token_bytes(TAM_NONCE)
    cifrado = _xor(datos, _flujo(k_enc, nonce, len(datos)))
    tag = hmac.new(k_mac, nonce + cifrado, hashlib.sha256).digest()
    return nonce + cifrado + tag


def descifrar(claves, blob):
    k_enc, k_mac = claves
    if len(blob) < TAM_NONCE + TAM_TAG:
        raise ValueError('datos no validos')
    nonce, cifrado, tag = blob[:TAM_NONCE], blob[TAM_NONCE:-TAM_TAG], blob[-TAM_TAG:]
    if not hmac.compare_digest(tag, hmac.new(k_mac, nonce + cifrado, hashlib.sha256).digest()):
        raise ValueError('clave incorrecta o datos alterados')
    return _xor(cifrado, _flujo(k_enc, nonce, len(cifrado)))
