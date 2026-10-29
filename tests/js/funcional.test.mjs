// Criterios FUNCIONAL C1-C12 (C13 se comprueba en la prueba guiada).
import test from 'node:test';
import assert from 'node:assert/strict';
import { nuevo, anadir, nuevaApp, MAESTRA } from './base.mjs';
import { AccesoDenegado, DatoInvalido } from '../../src/gestor/caja.js';
import { abrirEmergencia } from '../../src/gestor/caja.js';
import { Portapapeles } from '../../src/gestor/portapapeles.js';

const latin1 = (bytes) => Buffer.from(bytes).toString('latin1');

test('C1 guardar una entrada la muestra en la lista con su fecha de caducidad calculada', async () => {
  const { caja } = await nuevo();
  const e = anadir(caja, { sitio: 'Banco Ejemplo', dias: 30 });
  const lista = caja.listar();
  assert.deepEqual(lista.map((x) => x.sitio), ['Banco Ejemplo']);
  assert.equal(lista[0].caduca, '2026-02-14'); // 15 ene + 30 dias
  assert.equal(lista[0].id, e.id);
});

test('C2 avisa de caducadas y proximas, sin correo', async () => {
  const { caja, reloj, app } = await nuevo();
  anadir(caja, { sitio: 'A', dias: 3 });
  anadir(caja, { sitio: 'B', dias: 60 });
  anadir(caja, { sitio: 'C', dias: 1 });
  reloj.avanzar({ days: 2 });
  const avisos = Object.fromEntries(caja.avisos().map((a) => [a.sitio, a.motivo]));
  assert.deepEqual(avisos, { A: 'proxima', C: 'caducada' });
  assert.equal(app.enviarCorreo, undefined);
});

test('C2 la antelacion del aviso se puede programar', async () => {
  const { caja } = await nuevo();
  const e = anadir(caja, { sitio: 'A', dias: 20 });
  assert.deepEqual(caja.avisos(), []);
  caja.programarAviso(e.id, 30);
  assert.deepEqual(caja.avisos().map((a) => a.sitio), ['A']);
});

test('C3 generar: 20 por defecto, minimo 12', async () => {
  const { caja } = await nuevo();
  assert.equal(caja.generar().length, 20);
  assert.equal(caja.generar({ longitud: 12 }).length, 12);
  assert.throws(() => caja.generar({ longitud: 11 }), DatoInvalido);
});

test('C3 generar solo con los tipos de caracter elegidos', async () => {
  const { caja } = await nuevo();
  for (let i = 0; i < 30; i++) assert.match(caja.generar({ tipos: ['digitos'] }), /^[0-9]+$/);
  for (let i = 0; i < 30; i++) assert.match(caja.generar({ tipos: ['mayusculas', 'digitos'] }), /^[A-Z0-9]+$/);
});

test('C4 deshacer devuelve la contrasena anterior', async () => {
  const { caja, reloj } = await nuevo();
  const e = anadir(caja, { contrasena: 'Anterior-Aa1!xx' });
  caja.actualizar(e.id, { contrasena: 'Nueva-Bb2!yy' });
  assert.equal(caja.ver(e.id), 'Nueva-Bb2!yy');
  reloj.avanzar({ seconds: 19 });
  caja.deshacer();
  assert.equal(caja.ver(e.id), 'Anterior-Aa1!xx');
});

test('C5 el Excel contiene sitio, usuario, tipo y fecha', async () => {
  const { caja } = await nuevo();
  anadir(caja, { sitio: 'Banco Ejemplo', usuario: 'cuenta1@example.com', dias: 30, tipo: 'Finanzas' });
  const texto = latin1(caja.exportarExcel());
  assert.ok(texto.startsWith('PK'), 'es un zip');
  for (const esperado of ['[Content_Types].xml', 'xl/worksheets/sheet1.xml', 'Banco Ejemplo', 'cuenta1@example.com', 'Finanzas', '2026-02-14']) {
    assert.ok(texto.includes(esperado), esperado);
  }
});

test('C6 la clave de emergencia se confirma y la anterior deja de valer', async () => {
  const { caja, reloj } = await nuevo();
  const k1 = await caja.generarClaveEmergencia();
  assert.equal(caja.emergenciaPendiente, true);
  caja.confirmarClaveEmergencia();
  assert.equal(caja.emergenciaPendiente, false);
  const k2 = await caja.generarClaveEmergencia();
  caja.confirmarClaveEmergencia();
  assert.notEqual(k1, k2);
  const contenedor = await caja.contenedor();
  await assert.rejects(() => abrirEmergencia(contenedor, k1, { reloj }), AccesoDenegado);
  assert.ok(await abrirEmergencia(contenedor, k2, { reloj }));
});

test('C7 el calendario .ics lleva fecha y sitio', async () => {
  const { caja } = await nuevo();
  anadir(caja, { sitio: 'Banco Ejemplo', dias: 30 });
  const ics = caja.exportarIcs();
  for (const esperado of ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'Banco Ejemplo', '20260214']) assert.ok(ics.includes(esperado), esperado);
});

test('C8 la contrasena solo se ve con Ver y el portapapeles se borra a los 30 s', async () => {
  const { caja, reloj } = await nuevo();
  const e = anadir(caja, { contrasena: 'Secreta-Aa1!xx' });
  assert.equal('contrasena' in caja.listar()[0], false);
  assert.equal(caja.ver(e.id), 'Secreta-Aa1!xx');
  const portapapeles = { texto: '' };
  const p = new Portapapeles(reloj, (t) => { portapapeles.texto = t; });
  caja.copiar(e.id, p);
  assert.equal(portapapeles.texto, 'Secreta-Aa1!xx');
  reloj.avanzar({ seconds: 29 }); p.tick();
  assert.equal(portapapeles.texto, 'Secreta-Aa1!xx');
  reloj.avanzar({ seconds: 1 }); p.tick();
  assert.equal(portapapeles.texto, '');
});

test('C9 buscar y filtrar', async () => {
  const { caja, reloj } = await nuevo();
  anadir(caja, { sitio: 'Banco Ejemplo', usuario: 'uno@example.com', dias: 90 });
  anadir(caja, { sitio: 'Correo Ejemplo', usuario: 'dos@example.com', dias: 2 });
  reloj.avanzar({ days: 5 });
  assert.deepEqual(caja.listar({ buscar: 'banco' }).map((e) => e.sitio), ['Banco Ejemplo']);
  assert.deepEqual(caja.listar({ buscar: 'dos@' }).map((e) => e.sitio), ['Correo Ejemplo']);
  assert.deepEqual(caja.listar({ estado: 'Caducada' }).map((e) => e.sitio), ['Correo Ejemplo']);
  assert.deepEqual(caja.listar({ buscar: 'no-existe' }), []);
});

test('C10 renovar varias en seco no modifica hasta confirmar', async () => {
  const { caja } = await nuevo();
  const a = anadir(caja, { sitio: 'A', contrasena: 'Vieja-A-Aa1!xx' });
  const b = anadir(caja, { sitio: 'B', contrasena: 'Vieja-B-Aa1!xx' });
  let informe = caja.renovarVarias([a.id, b.id]); // por defecto: prueba en seco
  assert.deepEqual(informe, { cambios: 2, aplicado: false });
  assert.equal(caja.ver(a.id), 'Vieja-A-Aa1!xx');
  assert.equal(caja.ver(b.id), 'Vieja-B-Aa1!xx');
  informe = caja.renovarVarias([a.id, b.id], { confirmar: true });
  assert.equal(informe.aplicado, true);
  assert.notEqual(caja.ver(a.id), 'Vieja-A-Aa1!xx');
  assert.notEqual(caja.ver(b.id), 'Vieja-B-Aa1!xx');
});

test('C11 el registro anota alta, ver, exportacion, cambio e inicio de sesion', async () => {
  const { caja } = await nuevo();
  const e = anadir(caja);
  caja.ver(e.id);
  caja.exportarExcel();
  caja.actualizar(e.id, { sitio: 'Otro' });
  const acciones = new Set(caja.registro().map((r) => r.accion));
  for (const a of ['inicio_sesion', 'alta', 'ver_contrasena', 'exportacion', 'cambio']) assert.ok(acciones.has(a), a);
  assert.ok(caja.registro().every((r) => r.fecha));
});

test('C11 el registro es solo de su dueno y nunca lleva contrasenas', async () => {
  const { caja, reloj, mapa } = await nuevo();
  const e = anadir(caja, { contrasena: 'NoDebeVerse-Aa1!xx' });
  caja.ver(e.id);
  assert.ok(!JSON.stringify(caja.registro()).includes('NoDebeVerse-Aa1!xx'));
  await caja.contenedor();
  const app2 = nuevaApp(reloj, mapa, 'usuario2@example.com');
  await app2.iniciarSesion();
  const caja2 = await app2.crearCaja('Otra-Maestra-Ficticia-2');
  assert.ok(!caja2.registro().some((r) => r.accion === 'alta'));
});

test('C12 editar y borrar una entrada', async () => {
  const { caja } = await nuevo();
  const e = anadir(caja, { sitio: 'Viejo' });
  caja.actualizar(e.id, { sitio: 'Nuevo', usuario: 'nuevo@example.com' });
  assert.equal(caja.listar()[0].sitio, 'Nuevo');
  assert.equal(caja.listar()[0].usuario, 'nuevo@example.com');
  caja.borrar(e.id);
  assert.deepEqual(caja.listar(), []);
});
