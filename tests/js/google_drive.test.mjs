// Criterios C27-C30: Google Drive (con un "Drive" ficticio en memoria; nunca se llama a Google de verdad).
import test from 'node:test';
import assert from 'node:assert/strict';
import { nuevo, anadir, nuevaApp, RelojFalso, MAESTRA, ITER } from './base.mjs';
import { Aplicacion } from '../../src/gestor/aplicacion.js';
import { AlmacenMemoria } from '../../src/gestor/almacen.js';
import { AlmacenDrive, ALCANCE } from '../../src/gestor/drive.js';

// Drive ficticio: entiende solo las llamadas que hace AlmacenDrive y las anota.
function driveFalso() {
  const ficheros = new Map(); // id -> texto
  const llamadas = [];
  let siguiente = 1;
  const fetchFalso = async (url, opciones = {}) => {
    const metodo = opciones.method || 'GET';
    llamadas.push({ url: String(url), metodo, cabeceras: opciones.headers || {} });
    const u = new URL(url);
    const respuesta = (cuerpo, status = 200) => ({ ok: status < 300, status, json: async () => cuerpo, text: async () => String(cuerpo) });
    if (u.pathname === '/drive/v3/files' && metodo === 'GET') {
      return respuesta({ files: [...ficheros.keys()].map((id) => ({ id, name: 'caja.json' })) });
    }
    const m = u.pathname.match(/\/files\/([^/?]+)$/);
    if (u.pathname.startsWith('/upload') && metodo === 'POST') {
      const id = 'f' + siguiente++;
      ficheros.set(id, opciones.body.split('\r\n\r\n').pop().replace(/\r\n--[^\r\n]*--\s*$/, ''));
      return respuesta({ id });
    }
    if (m && u.pathname.startsWith('/upload') && metodo === 'PATCH') { ficheros.set(m[1], opciones.body); return respuesta({ id: m[1] }); }
    if (m && metodo === 'GET') return ficheros.has(m[1]) ? respuesta(ficheros.get(m[1])) : respuesta('', 404);
    if (m && metodo === 'DELETE') { ficheros.delete(m[1]); return respuesta('', 204); }
    return respuesta('', 400);
  };
  return { fetchFalso, llamadas, ficheros };
}

function appConDrive(reloj, drive) {
  return new Aplicacion({
    identidad: { iniciarSesion: async () => ({ usuario: 'google', token: 'xxx-ficticio' }) },
    crearAlmacen: (sesion) => new AlmacenDrive(sesion.token, drive.fetchFalso),
    reloj, iteraciones: ITER,
  });
}

test('C27 una caja guardada en Drive se abre desde otro dispositivo con la misma cuenta y maestra', async () => {
  const reloj = new RelojFalso();
  const drive = driveFalso();
  const movil = appConDrive(reloj, drive);
  await movil.iniciarSesion();
  const caja = await movil.crearCaja(MAESTRA);
  anadir(caja, { sitio: 'Banco Ejemplo' });
  assert.equal(await movil.guardar(), true);
  const ordenador = appConDrive(reloj, drive); // otro dispositivo
  await ordenador.iniciarSesion();
  assert.equal((await ordenador.iniciar()).hayCaja, true);
  const caja2 = await ordenador.abrirCaja(MAESTRA);
  assert.deepEqual(caja2.listar().map((e) => e.sitio), ['Banco Ejemplo']);
});

test('C28 a Drive solo llega texto cifrado', async () => {
  const reloj = new RelojFalso();
  const drive = driveFalso();
  const app = appConDrive(reloj, drive);
  await app.iniciarSesion();
  const caja = await app.crearCaja(MAESTRA);
  anadir(caja, { sitio: 'Banco Secreto', usuario: 'cuenta-secreta@example.com', contrasena: 'TextoClaro-Aa1!xx' });
  await app.guardar();
  const enviado = [...drive.ficheros.values()].join('|') + drive.llamadas.map((l) => l.url).join('|');
  for (const prohibido of ['Banco Secreto', 'cuenta-secreta@example.com', 'TextoClaro-Aa1!xx', MAESTRA]) {
    assert.ok(!enviado.includes(prohibido), prohibido);
  }
});

test('C29 la app pide un solo permiso y solo toca la carpeta de la app en Drive', async () => {
  assert.equal(ALCANCE, 'https://www.googleapis.com/auth/drive.appdata');
  const reloj = new RelojFalso();
  const drive = driveFalso();
  const app = appConDrive(reloj, drive);
  await app.iniciarSesion();
  const caja = await app.crearCaja(MAESTRA);
  anadir(caja);
  await app.guardar(); await app.guardar(); await app.iniciar();
  assert.ok(drive.llamadas.length > 0);
  for (const l of drive.llamadas) {
    assert.ok(l.url.startsWith('https://www.googleapis.com/'), l.url);
    assert.equal(l.cabeceras.Authorization, 'Bearer xxx-ficticio');
  }
  // la busqueda se limita a la carpeta de la app; la creacion la pone dentro de ella
  assert.ok(drive.llamadas.filter((l) => l.metodo === 'GET' && l.url.includes('/files?')).every((l) => l.url.includes('spaces=appDataFolder')));
  const creaciones = drive.llamadas.filter((l) => l.metodo === 'POST');
  assert.ok(creaciones.length >= 1);
});

test('C30 si falla el guardado el cambio no se pierde y se guarda al reintentar', async () => {
  const reloj = new RelojFalso();
  const mapa = new Map();
  const almacenes = [];
  const app = new Aplicacion({
    identidad: { iniciarSesion: async () => ({ usuario: 'u', token: 't' }) },
    crearAlmacen: (s) => { const a = new AlmacenMemoria(mapa, s.usuario); almacenes.push(a); return a; },
    reloj, iteraciones: ITER,
  });
  await app.iniciarSesion();
  const caja = await app.crearCaja(MAESTRA);
  almacenes[0].fallar = true; // sin conexion / sesion caducada
  anadir(caja, { sitio: 'Pendiente Ejemplo' });
  assert.equal(await app.guardar(), false);
  assert.equal(app.pendiente, true);
  assert.deepEqual(caja.listar().map((e) => e.sitio), ['Pendiente Ejemplo']); // sigue en memoria
  almacenes[0].fallar = false;
  assert.equal(await app.guardar(), true);
  assert.equal(app.pendiente, false);
  const otra = nuevaApp(reloj, mapa, 'u'); await otra.iniciarSesion();
  assert.deepEqual((await otra.abrirCaja(MAESTRA)).listar().map((e) => e.sitio), ['Pendiente Ejemplo']);
});
