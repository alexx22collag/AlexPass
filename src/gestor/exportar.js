// Exportaciones: Excel (.xlsx) y calendario (.ics). Nunca incluyen contraseñas.
const enc = new TextEncoder();

const escXml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ZIP minimo sin compresion (suficiente para un .xlsx).
function zip(ficheros) {
  const trozos = [];
  const central = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of ficheros) {
    const n = enc.encode(nombre);
    const d = enc.encode(contenido);
    const crc = crc32(d);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, d.length, true); local.setUint32(22, d.length, true);
    local.setUint16(26, n.length, true);
    trozos.push(new Uint8Array(local.buffer), n, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true);
    c.setUint16(28, n.length, true); c.setUint32(42, desplazamiento, true);
    central.push(new Uint8Array(c.buffer), n);
    desplazamiento += 30 + n.length + d.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, ficheros.length, true); fin.setUint16(10, ficheros.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplazamiento, true);
  const todos = [...trozos, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todos.reduce((s, x) => s + x.length, 0));
  let pos = 0;
  for (const x of todos) { salida.set(x, pos); pos += x.length; }
  return salida;
}

const celda = (t) => `<c t="inlineStr"><is><t>${escXml(t)}</t></is></c>`;

// filas: [[sitio, usuario, tipo, fechaISO], ...]
export function aExcel(filas) {
  const hoja = [['Sitio', 'Usuario', 'Tipo', 'Caducidad'], ...filas]
    .map((f) => `<row>${f.map(celda).join('')}</row>`).join('');
  const x = '<?xml version="1.0" encoding="UTF-8"?>';
  return zip([
    ['[Content_Types].xml', `${x}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ['_rels/.rels', `${x}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${x}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Caducidades" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${x}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ['xl/worksheets/sheet1.xml', `${x}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${hoja}</sheetData></worksheet>`],
  ]);
}

const textoIcs = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, ' ');

// eventos: [{id, sitio, fecha: 'YYYY-MM-DD'}]. Un evento de dia completo por contraseña.
export function aIcs(eventos, ahora) {
  const sello = ahora.toISOString().replace(/[-:]/g, '').slice(0, 15);
  const l = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gestor de contrasenas//ES', 'CALSCALE:GREGORIAN'];
  for (const e of eventos) {
    l.push('BEGIN:VEVENT', `UID:${e.id}@gestor-contrasenas`, `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${e.fecha.replace(/-/g, '')}`, `SUMMARY:${textoIcs('Caduca la contraseña de ' + e.sitio)}`, 'END:VEVENT');
  }
  l.push('END:VCALENDAR');
  return l.join('\r\n') + '\r\n';
}
