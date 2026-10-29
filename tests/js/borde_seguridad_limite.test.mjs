// Criterios BORDE C14-C19, SEGURIDAD C20-C23, LIMITE C24-C26.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nuevo, nuevaApp, anadir, MAESTRA } from './base.mjs';
import { AccesoDenegado, LimiteExcedido, DeshacerNoDisponible, abrir, abrirEmergencia, crear } from '../../src/gestor/caja.js';
import { listaHtml, campoContrasenaHtml } from '../../src/gestor/vistas.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const latin1 = (bytes) => Buffer.from(bytes).toString('latin1');

function ficherosJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? ficherosJs(path.join(dir, d.name)) : /\.(js|html)$/.test(d.name) ? [path.join(dir, d.name)] : []);
}

test('C14 con la lista vacia hay mensaje y boton para anadir la primera', async () => {
  const { caja } = await nuevo();
  assert.deepEqual(caja.listar(), []);
  assert.equal(caja.mensajeVacio(), 'Aún no tienes contraseñas guardadas');
  const html = listaHtml([]);
  assert.ok(html.includes('Aún no tienes contraseñas guardadas'));
  assert.ok(html.includes('Añadir'));
});

test('C15 una fecha imposible se guarda y queda como Revisar', async () => {
  const { caja } = await nuevo();
  const cero = anadir(caja, { sitio: 'Cero', dias: 0 });
  const neg = anadir(caja, { sitio: 'Negativa', dias: -5 });
  const estados = Object.fromEntries(caja.listar().map((x) => [x.sitio, x.estado]));
  assert.deepEqual(estados, { Cero: 'Revisar', Negativa: 'Revisar' });
  assert.ok(cero.id && neg.id);
});

test('C16 renovar conserva la anterior hasta confirmar o 5 dias', async () => {
  const { caja, reloj } = await nuevo();
  const e = anadir(caja, { contrasena: 'Anterior-Aa1!xx' });
  caja.renovar(e.id, 'Nueva-Bb2!yy');
  assert.equal(caja.contrasenaAnterior(e.id), 'Anterior-Aa1!xx');
  reloj.avanzar({ days: 4, hours: 23 });
  assert.equal(caja.contrasenaAnterior(e.id), 'Anterior-Aa1!xx');
  reloj.avanzar({ hours: 2 });
  assert.equal(caja.contrasenaAnterior(e.id), null);
});

test('C16 confirmar descarta la anterior', async () => {
  const { caja } = await nuevo();
  const e = anadir(caja, { contrasena: 'Anterior-Aa1!xx' });
  caja.renovar(e.id, 'Nueva-Bb2!yy');
  caja.confirmarRenovacion(e.id);
  assert.equal(caja.contrasenaAnterior(e.id), null);
  assert.equal(caja.ver(e.id), 'Nueva-Bb2!yy');
});

test('C17 avisa de contrasena repetida y de usuario repetido', async () => {
  const { caja } = await nuevo();
  anadir(caja, { sitio: 'A', usuario: 'uno@example.com', contrasena: 'Misma-Aa1!xxxx' });
  anadir(caja, { sitio: 'B', usuario: 'dos@example.com', contrasena: 'Misma-Aa1!xxxx' });
  anadir(caja, { sitio: 'C', usuario: 'tres@example.com', contrasena: 'Unica-Bb2!yyyy' });
  anadir(caja, { sitio: 'C', usuario: 'tres@example.com', contrasena: 'Otra-Cc3!zzzz' });
  const tipos = caja.avisosDuplicados().map((a) => a.tipo + ':' + [...a.sitios].sort().join(','));
  assert.ok(tipos.includes('contrasena_repetida:A,B'));
  assert.ok(tipos.includes('usuario_repetido:C,C'));
});

test('C18 sin maestra ni clave no hay forma de abrir la caja y no hay recuperacion por terceros', async () => {
  const { caja, reloj, app } = await nuevo();
  anadir(caja);
  const contenedor = await caja.contenedor();
  await assert.rejects(() => abrir(contenedor, 'maestra-equivocada', { reloj }), AccesoDenegado);
  await assert.rejects(() => abrirEmergencia(contenedor, 'clave-equivocada', { reloj }), AccesoDenegado);
  for (const nombre of ['recuperar', 'restablecerMaestra', 'recuperarCaja']) assert.equal(app[nombre], undefined);
});

test('C18 con la clave de emergencia se recupera el acceso', async () => {
  const { caja, reloj } = await nuevo();
  anadir(caja, { sitio: 'Banco Ejemplo' });
  const clave = await caja.generarClaveEmergencia();
  caja.confirmarClaveEmergencia();
  const recuperada = await abrirEmergencia(await caja.contenedor(), clave, { reloj });
  assert.deepEqual(recuperada.listar().map((e) => e.sitio), ['Banco Ejemplo']);
});

test('C19 tras la baja la caja se conserva 30 dias y se borra al abrir la app pasado el plazo', async () => {
  const { app, caja, reloj, mapa } = await nuevo();
  anadir(caja);
  await app.darDeBaja();
  reloj.avanzar({ days: 29 });
  const app29 = nuevaApp(reloj, mapa); await app29.iniciarSesion();
  assert.equal((await app29.iniciar()).hayCaja, true);
  reloj.avanzar({ days: 2 });
  const app31 = nuevaApp(reloj, mapa); await app31.iniciarSesion();
  assert.equal((await app31.iniciar()).hayCaja, false);
  assert.equal(mapa.size, 0);
});

test('C20 sin login de Google o sin maestra no se muestra ningun dato', async () => {
  const { app, caja, reloj, mapa } = await nuevo();
  anadir(caja, { sitio: 'Banco Ejemplo' });
  await app.guardar();
  const sinLogin = nuevaApp(reloj, mapa);
  await assert.rejects(() => sinLogin.abrirCaja(MAESTRA), AccesoDenegado); // sin iniciar sesion
  const rechazada = nuevaApp(reloj, mapa, 'usuario1@example.com', false);
  await assert.rejects(() => rechazada.iniciarSesion(), AccesoDenegado);
  const conLogin = nuevaApp(reloj, mapa); await conLogin.iniciarSesion();
  await assert.rejects(() => conLogin.abrirCaja('maestra-equivocada'), AccesoDenegado);
  caja.cerrar();
  assert.throws(() => caja.listar(), AccesoDenegado); // caja cerrada
});

test('C20 otra cuenta no ve mis datos', async () => {
  const { app, caja, reloj, mapa } = await nuevo();
  anadir(caja);
  await app.guardar();
  const otra = nuevaApp(reloj, mapa, 'usuario2@example.com'); await otra.iniciarSesion();
  await assert.rejects(() => otra.abrirCaja(MAESTRA), AccesoDenegado); // ni siquiera tiene caja
});

test('C21 lo guardado esta cifrado, la maestra no se guarda y el cifrado es fuerte', async () => {
  const reloj = new (await import('./base.mjs')).RelojFalso();
  const caja = await crear(MAESTRA, { reloj }); // iteraciones por defecto
  anadir(caja, { contrasena: 'TextoClaro-Aa1!xx' });
  const contenedor = await caja.contenedor();
  assert.ok(!contenedor.includes('TextoClaro-Aa1!xx'));
  assert.ok(!contenedor.includes(MAESTRA));
  assert.ok(JSON.parse(contenedor).iter >= 600000, 'PBKDF2 con al menos 600000 iteraciones');
  assert.equal((await abrir(contenedor, MAESTRA, { reloj })).listar().length, 1);
});

test('C22 las contrasenas no quedan en el navegador', async () => {
  assert.ok(campoContrasenaHtml('contrasena').includes('autocomplete="new-password"'));
  assert.ok(!campoContrasenaHtml('contrasena').includes('value='));
  for (const f of ficherosJs(SRC)) {
    const texto = fs.readFileSync(f, 'utf8');
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(texto), 'almacenamiento local en ' + path.basename(f));
  }
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  assert.ok(html.includes('Content-Security-Policy'));
});

test('C23 ninguna exportacion lleva contrasenas ni la clave de emergencia', async () => {
  const { caja } = await nuevo();
  anadir(caja, { contrasena: 'NoExportar-Aa1!xx' });
  const clave = await caja.generarClaveEmergencia();
  const xlsx = latin1(caja.exportarExcel());
  const ics = caja.exportarIcs();
  for (const texto of [xlsx, ics, JSON.stringify(caja.registro())]) {
    assert.ok(!texto.includes('NoExportar-Aa1!xx'));
    assert.ok(!texto.includes(clave));
  }
});

test('C24 renovar varias admite 15 y rechaza 16 sin modificar nada', async () => {
  const { caja } = await nuevo();
  const ids = [];
  for (let i = 0; i < 16; i++) ids.push(anadir(caja, { sitio: 'S' + i, contrasena: `Vieja-${i}-Aa1!xx` }).id);
  const antes = ids.map((i) => caja.ver(i));
  assert.throws(() => caja.renovarVarias(ids, { confirmar: true }), LimiteExcedido);
  assert.deepEqual(ids.map((i) => caja.ver(i)), antes);
  assert.equal(caja.renovarVarias(ids.slice(0, 15), { confirmar: true }).cambios, 15);
});

test('C25 el margen para deshacer es de 20 segundos', async () => {
  const { caja, reloj } = await nuevo();
  const e = anadir(caja, { contrasena: 'Anterior-Aa1!xx' });
  caja.actualizar(e.id, { contrasena: 'Nueva-Bb2!yy' });
  reloj.avanzar({ seconds: 21 });
  assert.throws(() => caja.deshacer(), DeshacerNoDisponible);
  assert.equal(caja.ver(e.id), 'Nueva-Bb2!yy');
});

test('C26 el registro se conserva 12 meses', async () => {
  const { caja, reloj } = await nuevo();
  anadir(caja, { sitio: 'Antiguo' });
  reloj.avanzar({ days: 200 });
  anadir(caja, { sitio: 'Reciente' });
  reloj.avanzar({ days: 170 }); // el primero tiene 370 dias; el segundo, 170
  const altas = caja.registro().filter((r) => r.accion === 'alta');
  assert.equal(altas.length, 1);
  assert.ok(altas[0].fecha.slice(0, 10) > '2026-01-15');
});
