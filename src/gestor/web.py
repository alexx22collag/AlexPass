"""Piezas de la capa web que evitan que las contraseñas queden en el navegador."""
from html import escape

MENSAJE_VACIO = 'Aún no tienes contraseñas guardadas'


def cabeceras_respuesta():
    """Cabeceras que lleva toda respuesta: nada se guarda en cache ni se comparte con otros sitios."""
    return {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'",
    }


def campo_contrasena_html(nombre):
    """Campo de contraseña sin valor previo y sin autocompletado del navegador."""
    return ('<input type="password" name="%s" autocomplete="new-password" '
            'autocapitalize="off" spellcheck="false">' % escape(nombre, quote=True))


def pagina_lista(entradas):
    """Lista de entradas. Con la lista vacia: mensaje y boton para añadir la primera."""
    if not entradas:
        return ('<section><p>%s</p><a class="boton" href="/nueva">Añadir mi primera contraseña</a></section>'
                % MENSAJE_VACIO)
    filas = ''.join('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>'
                    % (escape(e.sitio), escape(e.usuario), e.caduca.isoformat(), escape(e.estado))
                    for e in entradas)
    return ('<table><tr><th>Sitio</th><th>Usuario</th><th>Caduca</th><th>Estado</th></tr>%s</table>'
            '<a class="boton" href="/nueva">Añadir contraseña</a>' % filas)
