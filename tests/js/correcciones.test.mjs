// Correcciones tras la revision de seguridad independiente (defectos contra criterios ya aprobados).
import test from 'node:test';
import assert from 'node:assert/strict';
import { RelojFalso, MAESTRA, nuevaApp, nuevo, anadir } from './base.mjs';
import { AccesoDenegado } from '../../src/gestor/caja.js';
import { AlmacenDrive } from '../../src/gestor/drive.js';

test('C16 renovar dos veces seguidas no destruye la contrasena original', async () => {
  const { caja } = await nuevo();
  const e = anadir(caja, { contrasena: 'Original-Aa1!xx' });
  caja.renovar(e.id, 'Segunda-Aa1!xx');
  caja.renovar(e.id, 'Tercera-Aa1!xx'); // sin confirmar la segunda
  assert.equal(caja.contrasenaAnterior(e.id), 'Original-Aa1!xx');
  assert.equal(caja.ver(e.id), 'Tercera-Aa1!xx');
});

test('C24 renovar varias con identificadores repetidos cuenta cada entrada una sola vez', async () => {
  const { caja } = await nuevo();
  const e = anadir(caja, { contrasena: 'Original-Aa1!xx' });
  const informe = caja.renovarVarias([e.id, e.id, e.id], { confirmar: true });
  assert.equal(informe.cambios, 1);
  assert.equal(caja.contrasenaAnterior(e.id), 'Original-Aa1!xx');
});

test('C18 una clave de emergencia nueva no la anula otro dispositivo con sesion antigua', async () => {
  const { reloj, mapa, app, caja } = await nuevo();
  const k1 = await caja.generarClaveEmergencia();
  caja.confirmarClaveEmergencia();
  await app.guardar();
  const movil = nuevaApp(reloj, mapa);
  await movil.iniciarSesion();
  const cajaMovil = await movil.abrirCaja(MAESTRA); // conoce solo la clave k1
  reloj.avanzar({ minutes: 5 });
  const k2 = await caja.generarClaveEmergencia(); // la web regenera y la imprime
  caja.confirmarClaveEmergencia();
  await app.guardar();
  reloj.avanzar({ minutes: 5 });
  anadir(cajaMovil, { sitio: 'Desde Movil' });
  assert.equal(await movil.guardar(), true); // el movil guarda con su copia antigua
  const otro = nuevaApp(reloj, mapa); await otro.iniciarSesion();
  assert.ok((await otro.abrirCajaEmergencia(k2)).listar().length >= 1); // k2 sigue valiendo
  const otro2 = nuevaApp(reloj, mapa); await otro2.iniciarSesion();
  await assert.rejects(() => otro2.abrirCajaEmergencia(k1), AccesoDenegado); // la revocada no vuelve
});

test('C30 si el fichero de Drive desaparece al guardar no se da por guardado: se vuelve a crear', async () => {
  const llamadas = [];
  const fetchFalso = async (url, o = {}) => {
    const m = o.method || 'GET';
    llamadas.push(m);
    const r = (c, s = 200) => ({ ok: s < 300, status: s, json: async () => c, text: async () => String(c) });
    if (m === 'GET' && new URL(url).pathname === '/drive/v3/files') return r({ files: [{ id: 'f1' }] });
    if (m === 'PATCH') return r('', 404); // el fichero ya no existe
    if (m === 'POST') return r({ id: 'f2' });
    return r('', 404);
  };
  const almacen = new AlmacenDrive('xxx-ficticio', fetchFalso);
  await almacen.escribir('{"v":1}');
  assert.ok(llamadas.includes('POST'), 'debe crear de nuevo el fichero');
});

test('C38 una caja con un numero de iteraciones absurdo se rechaza al instante sin derivar la clave', async () => {
  const { reloj, mapa, app } = await nuevo();
  await app.guardar();
  const clave = [...mapa.keys()][0];
  const c = JSON.parse(mapa.get(clave));
  c.iter = 6000000; // por encima del maximo admitido: podria bloquear el navegador
  mapa.set(clave, JSON.stringify(c));
  const b = nuevaApp(reloj, mapa); await b.iniciarSesion();
  const t0 = Date.now();
  await assert.rejects(() => b.abrirCaja(MAESTRA), AccesoDenegado);
  assert.ok(Date.now() - t0 < 500, 'tardo demasiado: derivo la clave con un valor absurdo');
});
