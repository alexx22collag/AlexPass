// Criterios C31-C34: sincronizar dos dispositivos con la misma cuenta (un "Drive" ficticio compartido).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RelojFalso, MAESTRA, nuevaApp, anadir } from './base.mjs';
import { AlmacenDrive } from '../../src/gestor/drive.js';
import { Aplicacion } from '../../src/gestor/aplicacion.js';

// Dos dispositivos (web y movil) con la caja ya creada y abierta en los dos.
async function dosDispositivos() {
  const reloj = new RelojFalso();
  const mapa = new Map();
  const web = nuevaApp(reloj, mapa);
  await web.iniciarSesion();
  const cajaWeb = await web.crearCaja(MAESTRA);
  anadir(cajaWeb, { sitio: 'Inicial Ejemplo' });
  await web.guardar();
  const movil = nuevaApp(reloj, mapa);
  await movil.iniciarSesion();
  const cajaMovil = await movil.abrirCaja(MAESTRA);
  return { reloj, mapa, web, movil, cajaWeb, cajaMovil };
}
const sitios = (caja) => caja.listar().map((e) => e.sitio).sort();

test('C31 Sincronizar trae lo creado, cambiado y borrado en otro dispositivo y sube lo propio', async () => {
  const { reloj, web, movil, cajaWeb, cajaMovil } = await dosDispositivos();
  reloj.avanzar({ minutes: 1 });
  anadir(cajaWeb, { sitio: 'Nueva Web' });
  cajaWeb.actualizar(cajaWeb.listar().find((e) => e.sitio === 'Inicial Ejemplo').id, { sitio: 'Inicial Renombrada' });
  await web.guardar();
  assert.deepEqual(sitios(cajaMovil), ['Inicial Ejemplo']); // el movil aun no se ha enterado
  anadir(cajaMovil, { sitio: 'Nueva Movil' });
  assert.equal(await movil.sincronizar(), true);
  assert.deepEqual(sitios(cajaMovil), ['Inicial Renombrada', 'Nueva Movil', 'Nueva Web']);
  assert.equal(await web.sincronizar(), true); // y la web recibe lo del movil
  assert.deepEqual(sitios(cajaWeb), ['Inicial Renombrada', 'Nueva Movil', 'Nueva Web']);
});

test('C32 dos contrasenas anadidas a la vez en dos dispositivos no se pierden', async () => {
  const { web, movil, cajaWeb, cajaMovil } = await dosDispositivos();
  anadir(cajaWeb, { sitio: 'Solo Web' });
  anadir(cajaMovil, { sitio: 'Solo Movil' }); // mismo contador interno en los dos dispositivos
  assert.equal(await web.guardar(), true);
  assert.equal(await movil.guardar(), true); // guardar fusiona antes de escribir: no pisa a la web
  assert.deepEqual(sitios(cajaMovil), ['Inicial Ejemplo', 'Solo Movil', 'Solo Web']);
  await web.sincronizar();
  assert.deepEqual(sitios(cajaWeb), ['Inicial Ejemplo', 'Solo Movil', 'Solo Web']);
});

test('C33 gana el cambio mas reciente y lo borrado en un dispositivo no reaparece', async () => {
  const { reloj, web, movil, cajaWeb, cajaMovil } = await dosDispositivos();
  const id = cajaWeb.listar()[0].id;
  reloj.avanzar({ minutes: 1 });
  cajaWeb.actualizar(id, { sitio: 'Version Web' });
  await web.guardar();
  reloj.avanzar({ minutes: 1 });
  cajaMovil.actualizar(id, { sitio: 'Version Movil' }); // mas reciente
  await movil.sincronizar();
  await web.sincronizar();
  assert.deepEqual(sitios(cajaWeb), ['Version Movil']);
  assert.deepEqual(sitios(cajaMovil), ['Version Movil']);
  reloj.avanzar({ minutes: 1 });
  cajaWeb.borrar(id);
  await web.guardar();
  await movil.sincronizar(); // el movil aun la tenia: debe borrarse, no devolverla
  await web.sincronizar();
  assert.deepEqual(sitios(cajaMovil), []);
  assert.deepEqual(sitios(cajaWeb), []);
});

test('C34 si la caja de Drive no se puede descifrar no se sobrescribe y a Drive solo llega texto cifrado', async () => {
  const { mapa, web, cajaWeb, reloj } = await dosDispositivos();
  const mapaAjeno = new Map();
  const ajena = nuevaApp(reloj, mapaAjeno); // otra caja con otra clave de datos
  await ajena.iniciarSesion();
  await ajena.crearCaja(MAESTRA);
  await ajena.guardar();
  const textoAjeno = [...mapaAjeno.values()][0];
  const clave = [...mapa.keys()][0];
  mapa.set(clave, textoAjeno);
  anadir(cajaWeb, { sitio: 'Secreta Ejemplo', contrasena: 'TextoClaro-Aa1!xx' });
  assert.equal(await web.sincronizar(), false);
  assert.equal(await web.guardar(), false);
  assert.equal(mapa.get(clave), textoAjeno); // intacto
  assert.equal(web.pendiente, true);
});

test('C34 el texto enviado a Drive en una sincronizacion sigue siendo solo cifrado', async () => {
  const reloj = new RelojFalso();
  const ficheros = new Map();
  const enviados = [];
  const fetchFalso = async (url, o = {}) => {
    const m = (o.method || 'GET');
    const u = new URL(url);
    const r = (c, s = 200) => ({ ok: s < 300, status: s, json: async () => c, text: async () => String(c) });
    if (u.pathname === '/drive/v3/files' && m === 'GET') return r({ files: [...ficheros.keys()].map((id) => ({ id })) });
    if (m === 'POST') { enviados.push(o.body); ficheros.set('f1', o.body.split('\r\n\r\n').pop().replace(/\r\n--[^\r\n]*--\s*$/, '')); return r({ id: 'f1' }); }
    if (m === 'PATCH') { enviados.push(o.body); ficheros.set('f1', o.body); return r({ id: 'f1' }); }
    return ficheros.has('f1') ? r(ficheros.get('f1')) : r('', 404);
  };
  const crear = () => new Aplicacion({ identidad: { iniciarSesion: async () => ({ usuario: 'u', token: 'xxx-ficticio' }) }, crearAlmacen: (s) => new AlmacenDrive(s.token, fetchFalso), reloj, iteraciones: 1000 });
  const a = crear(); await a.iniciarSesion();
  const caja = await a.crearCaja(MAESTRA);
  anadir(caja, { sitio: 'Banco Secreto', usuario: 'cuenta-secreta@example.com', contrasena: 'TextoClaro-Aa1!xx' });
  await a.guardar(); await a.sincronizar();
  for (const prohibido of ['Banco Secreto', 'cuenta-secreta@example.com', 'TextoClaro-Aa1!xx', MAESTRA]) {
    assert.ok(!enviados.join('|').includes(prohibido), prohibido);
  }
});
