"""Exportaciones: Excel (.xlsx) y calendario (.ics). Nunca incluyen contraseñas."""
import io
import zipfile
from xml.sax.saxutils import escape

CABECERA = ('Sitio', 'Usuario', 'Tipo', 'Caducidad')


def _celda(texto):
    return '<c t="inlineStr"><is><t>%s</t></is></c>' % escape(str(texto))


def a_excel(filas):
    """filas: lista de (sitio, usuario, tipo, fecha_iso). Devuelve los bytes de un .xlsx minimo."""
    todas = [CABECERA] + list(filas)
    hoja = ''.join('<row>%s</row>' % ''.join(_celda(c) for c in f) for f in todas)
    partes = {
        '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Caducidades" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/worksheets/sheet1.xml': '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>%s</sheetData></worksheet>' % hoja,
    }
    salida = io.BytesIO()
    with zipfile.ZipFile(salida, 'w', zipfile.ZIP_DEFLATED) as z:
        for nombre, contenido in partes.items():
            z.writestr(nombre, contenido)
    return salida.getvalue()


def _texto_ics(t):
    return str(t).replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', ' ')


def a_ics(eventos, ahora):
    """eventos: lista de (id, sitio, fecha). Un evento de dia completo por contraseña."""
    lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gestor de contrasenas//ES', 'CALSCALE:GREGORIAN']
    for ident, sitio, fecha in eventos:
        lineas += ['BEGIN:VEVENT',
                   'UID:%s@gestor-contrasenas' % ident,
                   'DTSTAMP:%s' % ahora.strftime('%Y%m%dT%H%M%S'),
                   'DTSTART;VALUE=DATE:%s' % fecha.strftime('%Y%m%d'),
                   'SUMMARY:%s' % _texto_ics('Caduca la contraseña de ' + sitio),
                   'END:VEVENT']
    lineas.append('END:VCALENDAR')
    return '\r\n'.join(lineas) + '\r\n'
