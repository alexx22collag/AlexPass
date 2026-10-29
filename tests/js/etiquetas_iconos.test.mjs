// Prototipo v2: carpetas, etiquetas e iconos automaticos (reconocimiento local, sin llamadas externas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAESTRA, nuevaApp, nuevo } from './base.mjs';
import { DatoInvalido } from '../../src/gestor/caja.js';
import { iconoDe, avatarHtml } from '../../src/gestor/iconos.js';
import { MARCAS } from '../../src/gestor/marcas.js';
import { listaHtml } from '../../src/gestor/vistas.js';

const alta = (caja, sitio, extra = {}) => caja.guardar(sitio, 'yo@example.com', 'Ficticia-Aa1!xx', 90, extra);

test('V2-ET1 carpetas y etiquetas: se guardan, se filtran y la busqueda las encuentra', async () => {
  const { caja } = await nuevo();
  alta(caja, 'Panel Uno', { carpeta: 'Trabajo', etiquetas: ['vpn', 'Importante'] });
  alta(caja, 'Panel Dos', { carpeta: 'Personal', etiquetas: ['vpn'] });
  alta(caja, 'Panel Tres');
  assert.deepEqual(caja.listar({ carpeta: 'Trabajo' }).map((e) => e.sitio), ['Panel Uno']);
  assert.deepEqual(caja.listar({ etiqueta: 'vpn' }).map((e) => e.sitio).sort(), ['Panel Dos', 'Panel Uno']);
  assert.deepEqual(caja.listar({ buscar: 'importante' }).map((e) => e.sitio), ['Panel Uno']);
  assert.deepEqual(caja.carpetas(), [{ nombre: 'Personal', n: 1 }, { nombre: 'Trabajo', n: 1 }]);
  assert.deepEqual(caja.etiquetas(), [{ nombre: 'Importante', n: 1 }, { nombre: 'vpn', n: 2 }]);
  const sin = caja.listar().find((e) => e.sitio === 'Panel Tres');
  assert.equal(sin.carpeta, ''); assert.deepEqual(sin.etiquetas, []);
});

test('V2-ET2 se validan los limites y se limpian los duplicados', async () => {
  const { caja } = await nuevo();
  assert.throws(() => alta(caja, 'A', { carpeta: 'x'.repeat(41) }), DatoInvalido);
  assert.throws(() => alta(caja, 'A', { etiquetas: Array.from({ length: 11 }, (_, i) => 'e' + i) }), DatoInvalido);
  assert.throws(() => alta(caja, 'A', { etiquetas: ['y'.repeat(31)] }), DatoInvalido);
  const e = alta(caja, 'B', { carpeta: '  Trabajo  ', etiquetas: [' vpn ', 'VPN', '', 'web'] });
  assert.equal(e.carpeta, 'Trabajo');
  assert.deepEqual(e.etiquetas, ['vpn', 'web']);
});

test('V2-ET3 editar cambia carpeta y etiquetas y se puede renombrar una carpeta entera', async () => {
  const { caja } = await nuevo();
  const a = alta(caja, 'Uno', { carpeta: 'Viejo' });
  alta(caja, 'Dos', { carpeta: 'Viejo' });
  caja.actualizar(a.id, { etiquetas: ['nueva'], carpeta: 'Otra' });
  assert.deepEqual(caja.listar({ etiqueta: 'nueva' }).map((e) => e.carpeta), ['Otra']);
  assert.equal(caja.renombrarCarpeta('Viejo', 'Nuevo'), 1);
  assert.deepEqual(caja.carpetas().map((c) => c.nombre).sort(), ['Nuevo', 'Otra']);
});

test('V2-ET4 carpetas y etiquetas viajan entre dispositivos al sincronizar y gana el cambio mas reciente', async () => {
  const { reloj, mapa, app, caja } = await nuevo();
  const e = alta(caja, 'Compartida', { carpeta: 'A', etiquetas: ['uno'] });
  await app.guardar();
  const movil = nuevaApp(reloj, mapa); await movil.iniciarSesion();
  const cajaMovil = await movil.abrirCaja(MAESTRA);
  assert.deepEqual(cajaMovil.listar({ carpeta: 'A' }).map((x) => x.sitio), ['Compartida']);
  reloj.avanzar({ minutes: 1 });
  cajaMovil.actualizar(e.id, { carpeta: 'B', etiquetas: ['dos'] });
  await movil.guardar();
  await app.sincronizar();
  assert.deepEqual(caja.listar({ carpeta: 'B', etiqueta: 'dos' }).map((x) => x.sitio), ['Compartida']);
});

test('V2-ET5 la carpeta y las etiquetas nunca salen en claro hacia Drive', async () => {
  const { mapa, app, caja } = await nuevo();
  alta(caja, 'Sitio Reservado', { carpeta: 'CarpetaSecreta', etiquetas: ['EtiquetaSecreta'] });
  await app.guardar();
  const texto = [...mapa.values()].join('|');
  for (const p of ['CarpetaSecreta', 'EtiquetaSecreta', 'Sitio Reservado']) assert.ok(!texto.includes(p), p);
});

test('V2-IC1 se reconocen las marcas habituales por el nombre, en cualquier forma de escribirlo', () => {
  const casos = [['Google', 'google'], ['gmail.com', 'gmail'], ['Mi cuenta de Netflix', 'netflix'], ['GitHub (trabajo)', 'github'],
    ['  SPOTIFY ', 'spotify'], ['www.paypal.com', 'paypal'], ['Facebook', 'facebook'], ['Instagram personal', 'instagram'],
    ['X', 'x'], ['Twitter', 'x'], ['ChatGPT', 'openai'], ['Claude', 'anthropic'], ['LinkedIn', 'linkedin'], ['Dropbox', 'dropbox'],
    ['Google Drive', 'googledrive'], ['AWS', 'amazonwebservices'], ['WhatsApp Web', 'whatsapp'], ['Steam', 'steam']];
  for (const [nombre, marca] of casos) assert.equal(iconoDe(nombre).marca, marca, nombre);
});

test('V2-IC2 lo que no se reconoce lleva avatar con la inicial y un color estable', () => {
  const a = iconoDe('Banco Ejemplo');
  assert.equal(a.marca, null); assert.equal(a.letra, 'B');
  assert.deepEqual(iconoDe('Banco Ejemplo'), a); // mismo nombre, mismo color
  assert.match(a.color, /^#[0-9a-f]{6}$/);
  assert.equal(iconoDe('Ñandú Ejemplo').letra, 'Ñ');
  assert.equal(iconoDe('').letra, '?');
  assert.equal(iconoDe('Banco X').marca, null); // una letra suelta dentro del nombre no es la marca X
  assert.equal(iconoDe('Panel line del taller').marca, null); // palabras corrientes que coinciden con marcas
  assert.equal(iconoDe('Panel de signal del taller').marca, null);
  const colores = new Set(['Zeta', 'Alfa', 'Mono', 'Pato', 'Lince', 'Roble'].map((n) => iconoDe(n + ' Ejemplo').color));
  assert.ok(colores.size > 1); // no son todos del mismo color
});

test('V2-IC3 el avatar es un SVG seguro: sin estilos en linea, sin scripts y con el texto escapado', () => {
  const marca = avatarHtml('Google');
  assert.ok(marca.startsWith('<svg') && marca.includes('<path'));
  const raro = avatarHtml('<script>alert(1)</script>');
  assert.ok(!/<script/i.test(raro) && !/style=/i.test(raro) && !/on\w+=/i.test(raro));
  assert.ok(!/style=/i.test(marca));
  const comillas = avatarHtml('"><img src=x onerror=alert(1)>');
  assert.ok(!/<img/i.test(comillas));
});

test('V2-IC4 la lista muestra avatar y etiquetas, escapando lo que escribe el usuario', () => {
  const html = listaHtml([{ id: 'e1', sitio: 'Google', usuario: 'yo@example.com', tipo: 'Otro', caduca: '2027-01-01', estado: 'Vigente',
    avisoDias: 7, carpeta: 'Trabajo', etiquetas: ['vpn', '<b>mal</b>'] }]);
  assert.ok(html.includes('<svg'));
  assert.ok(html.includes('Trabajo'));
  assert.ok(html.includes('&lt;b&gt;mal&lt;/b&gt;') && !html.includes('<b>mal</b>'));
});

test('V2-IC5 el paquete de logos es amplio y esta bien formado', () => {
  const claves = Object.keys(MARCAS);
  assert.ok(claves.length >= 100, 'pocos logos: ' + claves.length);
  for (const k of claves) {
    assert.match(MARCAS[k].h, /^[0-9a-f]{6}$/, k);
    assert.match(MARCAS[k].d, /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-eE]+$/, k); // solo trazado SVG: nada de codigo
    assert.ok(MARCAS[k].t.length > 0, k);
  }
});

test('V2-IC6 no hay llamadas a servicios externos para los iconos', () => {
  const html = avatarHtml('Netflix') + avatarHtml('Banco Ejemplo');
  assert.ok(!/https?:|<img|href=|url\(/i.test(html));
});
