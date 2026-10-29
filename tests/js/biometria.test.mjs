// Criterios C35-C38: entrar con Face ID/huella. El dispositivo se sustituye por un secreto ficticio (el "PRF").
import test from 'node:test';
import assert from 'node:assert/strict';
import { RelojFalso, MAESTRA, nuevaApp, anadir } from './base.mjs';
import { AccesoDenegado } from '../../src/gestor/caja.js';
import { b64 } from '../../src/gestor/cripto.js';

const SECRETO = Uint8Array.from({ length: 32 }, (_, i) => i + 1);   // lo que devolveria Face ID
const OTRO = Uint8Array.from({ length: 32 }, (_, i) => 200 - i);
const sitios = (caja) => caja.listar().map((e) => e.sitio).sort();

async function conCaja() {
  const reloj = new RelojFalso();
  const mapa = new Map();
  const app = nuevaApp(reloj, mapa);
  await app.iniciarSesion();
  const caja = await app.crearCaja(MAESTRA);
  anadir(caja, { sitio: 'Banco Ejemplo' });
  await app.guardar();
  return { reloj, mapa, app, caja };
}
async function otroDispositivo(reloj, mapa) {
  const a = nuevaApp(reloj, mapa);
  await a.iniciarSesion();
  return a;
}

test('C35 se activa Face ID con la maestra y despues abre la caja; maestra y emergencia siguen valiendo', async () => {
  const { reloj, mapa, app, caja } = await conCaja();
  assert.equal(await app.activarBiometria('cred-iphone', SECRETO), true);
  const emergencia = await caja.generarClaveEmergencia();
  caja.confirmarClaveEmergencia();
  await app.guardar();
  const iphone = await otroDispositivo(reloj, mapa);
  assert.deepEqual(sitios(await iphone.abrirCajaBiometria('cred-iphone', SECRETO)), ['Banco Ejemplo']);
  assert.deepEqual(sitios(await (await otroDispositivo(reloj, mapa)).abrirCaja(MAESTRA)), ['Banco Ejemplo']);
  assert.deepEqual(sitios(await (await otroDispositivo(reloj, mapa)).abrirCajaEmergencia(emergencia)), ['Banco Ejemplo']);
});

test('C36 un secreto o dispositivo que no corresponde no abre la caja ni cambia nada', async () => {
  const { reloj, mapa, app } = await conCaja();
  await app.activarBiometria('cred-iphone', SECRETO);
  const antes = [...mapa.values()][0];
  const b = await otroDispositivo(reloj, mapa);
  await assert.rejects(() => b.abrirCajaBiometria('cred-iphone', OTRO), AccesoDenegado);   // verificacion fallida
  await assert.rejects(() => b.abrirCajaBiometria('cred-desconocida', SECRETO), AccesoDenegado);
  await assert.rejects(() => b.abrirCajaBiometria('cred-iphone', new Uint8Array(0)), AccesoDenegado);
  assert.equal(b.caja, null);
  assert.equal([...mapa.values()][0], antes);
  assert.deepEqual(sitios(await b.abrirCaja(MAESTRA)), ['Banco Ejemplo']); // la maestra sigue sirviendo
});

test('C37 un dispositivo se quita, deja de abrir tambien en los demas tras sincronizar y no reaparece', async () => {
  const { reloj, mapa, app, caja } = await conCaja();
  await app.activarBiometria('cred-iphone', SECRETO);
  const otro = await otroDispositivo(reloj, mapa);
  const cajaOtro = await otro.abrirCaja(MAESTRA);
  assert.equal(caja.listarBiometria().length, 1);
  reloj.avanzar({ minutes: 1 });
  assert.equal(await app.quitarBiometria('cred-iphone'), true);
  assert.deepEqual(caja.listarBiometria(), []);
  await otro.sincronizar();                 // el otro dispositivo la tenia: ni debe conservarla ni devolverla
  assert.deepEqual(cajaOtro.listarBiometria(), []);
  await app.sincronizar();
  assert.deepEqual(caja.listarBiometria(), []);
  await assert.rejects(async () => (await otroDispositivo(reloj, mapa)).abrirCajaBiometria('cred-iphone', SECRETO), AccesoDenegado);
});

test('C38 a Drive solo llega texto cifrado: ni la clave de datos ni el secreto biometrico', async () => {
  const { mapa, app, caja } = await conCaja();
  await app.activarBiometria('cred-iphone', SECRETO);
  anadir(caja, { sitio: 'Otro Secreto', contrasena: 'TextoClaro-Aa1!xx' });
  await app.guardar();
  const texto = [...mapa.values()].join('|');
  for (const prohibido of [b64(SECRETO), Array.from(SECRETO).join(','), b64(caja._k), 'TextoClaro-Aa1!xx', 'Otro Secreto', MAESTRA]) {
    assert.ok(!texto.includes(prohibido), prohibido);
  }
  assert.equal(typeof globalThis.localStorage, 'undefined'); // y la clave no se guarda en el navegador (aqui no hay navegador)
});
