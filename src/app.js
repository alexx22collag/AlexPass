// Interfaz de la app (navegador). La logica esta en gestor/; aqui solo se pintan pantallas.
// Todo lo que escribe el usuario se escapa con esc() antes de pintarse.
import { identidadGoogle } from './auth.js';
import { CLIENT_ID } from './config.js';
import { Aplicacion } from './gestor/aplicacion.js';
import { AccesoDenegado, DatoInvalido, DeshacerNoDisponible, LimiteExcedido } from './gestor/caja.js';
import { AlmacenDrive } from './gestor/drive.js';
import { Portapapeles } from './gestor/portapapeles.js';
import * as biometria from './biometria.js';
import { campoContrasenaHtml, esc, listaHtml } from './gestor/vistas.js';

const reloj = { ahora: () => new Date() };
const app = new Aplicacion({
  identidad: identidadGoogle(CLIENT_ID),
  crearAlmacen: (sesion) => new AlmacenDrive(sesion.token),
  reloj,
});
const portapapeles = new Portapapeles(reloj, (t) => { navigator.clipboard.writeText(t).catch(() => {}); });

const $ = (s) => document.querySelector(s);
const vista = $('#vista');
let filtro = { buscar: '', estado: '' };
let deshacerHasta = 0;
let infoBaja = null;
let bioPendiente = null; // id de una passkey recien creada que aun no ha dado su secreto

// ---------- utilidades ----------
function estado(texto, error = false) {
  const p = $('#estado');
  p.textContent = texto;
  p.className = error ? 'mal' : '';
}

function mostrar(html) { vista.innerHTML = html; }

function mensajeError(e) {
  if (e instanceof AccesoDenegado || e instanceof DatoInvalido || e instanceof LimiteExcedido || e instanceof DeshacerNoDisponible) return e.message;
  return 'Ha ocurrido un error. Inténtalo de nuevo.'; // sin detalles internos
}

async function persistir() {
  const ok = await app.guardar();
  if (ok) estado('Guardado en tu Google Drive.');
  else estado('No se ha podido guardar. Tus cambios siguen aquí: pulsa «Reconectar» para reintentarlo.', true);
  return ok;
}

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const caja = () => app.caja;
const fecha = (iso) => iso.slice(0, 16).replace('T', ' ');

// ---------- pantallas ----------
function pantallaLogin() {
  $('#cerrar').classList.add('oculto');
  mostrar(`<section class="tarjeta"><h2>Tu gestor de contraseñas</h2>
    <p>Inicia sesión con Google. Tus contraseñas se cifran en este dispositivo y solo se guarda texto cifrado en una carpeta privada de tu Google Drive.</p>
    <div class="fila-botones"><button type="button" class="primario" data-accion="login">Iniciar sesión con Google</button></div></section>`);
}

function pantallaCaja(info) {
  infoBaja = info.baja || null;
  if (!info.hayCaja) {
    mostrar(`<section class="tarjeta"><h2>Crea tu caja</h2>
      <p>Elige una contraseña maestra de al menos 12 caracteres. <strong>Si la pierdes y no tienes la clave de emergencia, nadie podrá recuperar tus datos.</strong></p>
      <form data-form="crear"><label for="maestra">Contraseña maestra</label>${campoContrasenaHtml('maestra')}
      <label for="maestra2">Repítela</label>${campoContrasenaHtml('maestra2')}
      <div class="fila-botones"><button class="primario" type="submit">Crear caja</button></div></form></section>`);
    return;
  }
  mostrar(`<section class="tarjeta"><h2>Abre tu caja</h2>
    ${info.baja ? `<p class="aviso mal">Esta caja está dada de baja desde ${esc(fecha(info.baja))} y se borrará pasados 30 días.</p>` : ''}
    <form data-form="abrir"><label for="maestra">Contraseña maestra</label>${campoContrasenaHtml('maestra')}
    <div class="fila-botones"><button class="primario" type="submit">Abrir</button>
    <button type="button" class="oculto" id="boton-face-id" data-accion="entrar-face-id">Entrar con Face ID</button>
    <button type="button" data-accion="emergencia-entrar">Usar clave de emergencia</button></div></form></section>`);
  if (info.tieneBio) biometria.soportado().then((ok) => { const b = $('#boton-face-id'); if (ok && b) b.classList.remove('oculto'); });
}

function pantallaEmergenciaEntrar() {
  mostrar(`<section class="tarjeta"><h2>Clave de emergencia</h2>
    <form data-form="abrir-emergencia"><label for="clave">Clave de emergencia</label>${campoContrasenaHtml('clave')}
    <div class="fila-botones"><button class="primario" type="submit">Abrir</button><button type="button" data-accion="volver-abrir">Volver</button></div></form></section>`);
}

function pantallaLista() {
  $('#cerrar').classList.remove('oculto');
  const c = caja();
  const avisos = c.avisos().map((a) => `<p class="aviso ${a.motivo === 'caducada' ? 'mal' : ''}">${a.motivo === 'caducada' ? 'Caducada' : 'Caduca pronto'}: <strong>${esc(a.sitio)}</strong></p>`).join('');
  const dups = c.avisosDuplicados().map((d) => `<p class="aviso">${d.tipo === 'contrasena_repetida' ? 'Misma contraseña en' : 'Usuario repetido en'}: ${esc(d.sitios.join(', '))}</p>`).join('');
  const baja = infoBaja ? `<p class="aviso mal">Caja dada de baja: se borrará 30 días después del ${esc(fecha(infoBaja))}.</p>` : '';
  mostrar(`${baja}${avisos}${dups}
    <div class="fila-botones"><button type="button" class="primario" data-accion="nueva">Añadir contraseña</button>
      <button type="button" data-accion="renovar-varias">Renovar varias</button></div>
    <label for="buscar">Buscar</label><input id="buscar" type="search" value="${esc(filtro.buscar)}" autocomplete="off" placeholder="Sitio o usuario">
    <label for="filtro">Estado</label><select id="filtro">${['', 'Vigente', 'Por caducar', 'Caducada', 'Revisar'].map((e) => `<option value="${e}" ${filtro.estado === e ? 'selected' : ''}>${e || 'Todos'}</option>`).join('')}</select>
    <div id="resultado">${listaHtml(c.listar(filtro))}</div>
    <div class="fila-botones"><button type="button" data-accion="excel">Exportar a Excel</button><button type="button" data-accion="ics">Calendario (.ics)</button>
      <button type="button" data-accion="registro">Registro</button><button type="button" data-accion="emergencia">Clave de emergencia</button>
      <button type="button" data-accion="face-id">Face ID</button><button type="button" data-accion="sincronizar">Sincronizar</button><button type="button" data-accion="reconectar">Reconectar</button><button type="button" class="peligro" data-accion="baja">Dar de baja</button></div>`);
}

function pantallaDetalle(id, secreto = null) {
  const e = caja().listar().find((x) => x.id === id);
  if (!e) { pantallaLista(); return; }
  const anterior = caja().contrasenaAnterior(id);
  mostrar(`<section class="tarjeta"><h2>${esc(e.sitio)}</h2><p>${esc(e.usuario)} · caduca ${esc(e.caduca)} · ${esc(e.estado)} · ${esc(e.tipo)}</p>
    ${secreto !== null ? `<p class="secreto">${esc(secreto)}</p>` : ''}
    ${anterior !== null ? '<p class="aviso">Hay una contraseña anterior guardada 5 días por si la nueva no funciona.</p>' : ''}
    <div class="fila-botones">
      <button type="button" data-accion="ver" data-id="${esc(id)}">Ver</button><button type="button" data-accion="copiar" data-id="${esc(id)}">Copiar</button>
      <button type="button" data-accion="editar" data-id="${esc(id)}">Editar</button><button type="button" data-accion="renovar" data-id="${esc(id)}">Renovar</button>
      ${anterior !== null ? `<button type="button" data-accion="confirmar-renovacion" data-id="${esc(id)}">La nueva funciona</button>` : ''}
      <button type="button" class="peligro" data-accion="borrar" data-id="${esc(id)}">Borrar</button><button type="button" data-accion="lista">Volver</button></div></section>`);
}

function pantallaFormulario(id = null, propuesta = '') {
  const e = id ? caja().listar().find((x) => x.id === id) : null;
  mostrar(`<section class="tarjeta"><h2>${e ? 'Editar' : 'Nueva'} contraseña</h2>
    <form data-form="guardar" data-id="${esc(id || '')}">
    <label for="sitio">Sitio</label><input id="sitio" name="sitio" required autocomplete="off" value="${esc(e ? e.sitio : '')}">
    <label for="usuario">Usuario o correo</label><input id="usuario" name="usuario" required autocomplete="off" value="${esc(e ? e.usuario : '')}">
    <label for="contrasena">Contraseña ${e ? '(déjala vacía para no cambiarla)' : ''}</label>${campoContrasenaHtml('contrasena')}
    <div class="fila-botones"><button type="button" data-accion="generar">Generar aleatoria</button></div>
    <label for="longitud">Longitud (mínimo 12)</label><input id="longitud" type="number" min="12" max="128" value="20">
    <label for="dias">Caduca dentro de (días)</label><input id="dias" name="dias" type="number" required value="90">
    <label for="tipo">Tipo</label><input id="tipo" name="tipo" autocomplete="off" value="${esc(e ? e.tipo : 'Otro')}">
    <label for="aviso">Avisarme (días antes)</label><input id="aviso" name="aviso" type="number" min="0" max="365" value="${e ? e.avisoDias : 7}">
    <div class="fila-botones"><button class="primario" type="submit">Guardar</button><button type="button" data-accion="lista">Cancelar</button></div></form></section>`);
  if (propuesta) $('#contrasena').value = propuesta;
}

function pantallaRenovarVarias(informe = null, marcados = []) {
  const entradas = caja().listar();
  mostrar(`<section class="tarjeta"><h2>Renovar varias (máximo 15)</h2>
    <form data-form="renovar-varias">${entradas.map((e) => `<label><input type="checkbox" name="id" value="${esc(e.id)}" ${marcados.includes(e.id) ? 'checked' : ''}>${esc(e.sitio)} · ${esc(e.estado)}</label>`).join('')}
    ${informe ? `<p class="aviso">Prueba en seco: se cambiarían <strong>${informe.cambios}</strong> contraseñas. No se ha modificado nada todavía.</p>` : ''}
    <div class="fila-botones"><button type="submit" data-modo="seco">Prueba en seco</button>
    ${informe ? '<button type="submit" class="primario" data-modo="confirmar">Confirmar cambios</button>' : ''}<button type="button" data-accion="lista">Volver</button></div></form></section>`);
}

function pantallaRegistro() {
  const filas = caja().registro().slice().reverse().map((r) => `<tr><td>${esc(fecha(r.fecha))}</td><td>${esc(r.accion)}</td><td>${esc(r.detalle)}</td></tr>`).join('');
  mostrar(`<section class="tarjeta"><h2>Registro de acciones (12 meses)</h2>
    <p class="aviso">El registro está dentro de tu caja cifrada. No es una auditoría a prueba de manipulación.</p>
    <table><tr><th>Cuándo</th><th>Acción</th><th>Detalle</th></tr>${filas}</table>
    <div class="fila-botones"><button type="button" data-accion="lista">Volver</button></div></section>`);
}

function pantallaEmergencia(clave = null) {
  mostrar(`<section class="tarjeta"><h2>Clave de emergencia</h2>
    ${clave ? `<p class="secreto clave-emergencia">${esc(clave)}</p>
      <p><strong>Imprímela o anótala ahora. No se vuelve a mostrar</strong> y nunca se envía por correo. Si generas otra, esta deja de valer.</p>
      <form data-form="confirmar-emergencia"><label><input type="checkbox" id="guardada" required>La he guardado en un sitio seguro</label>
      <div class="fila-botones"><button type="button" data-accion="imprimir">Imprimir</button><button class="primario" type="submit">Confirmar</button></div></form>`
    : `<p>Sirve para abrir la caja si olvidas la contraseña maestra. Si pierdes las dos cosas, se pierde todo: no hay recuperación por terceros.</p>
      <div class="fila-botones"><button type="button" class="primario" data-accion="generar-emergencia">Generar clave</button><button type="button" data-accion="lista">Volver</button></div>`}
  </section>`);
}

async function pantallaFaceId() {
  const ids = caja().listarBiometria();
  const posible = await biometria.soportado();
  mostrar(`<section class="tarjeta"><h2>Face ID / huella</h2>
    <p>Permite abrir la caja con Face ID o la huella en vez de la contraseña maestra (sigue haciendo falta iniciar sesión con Google). La maestra y la clave de emergencia siguen funcionando. Quien pueda desbloquear este dispositivo podrá abrir la caja.</p>
    <p>Dispositivos activados: <strong>${ids.length}</strong></p>
    ${ids.map((id, i) => `<div class="fila-botones"><span>Dispositivo ${i + 1}</span><button type="button" class="peligro" data-accion="quitar-face-id" data-id="${esc(id)}">Quitar</button></div>`).join('')}
    <div class="fila-botones">
      ${bioPendiente ? '<button type="button" class="primario" data-accion="terminar-face-id">Terminar activación con Face ID</button>'
        : posible ? '<button type="button" class="primario" data-accion="activar-face-id">Activar en este dispositivo</button>'
        : '<span class="aviso">Este dispositivo o navegador no permite Face ID para abrir la caja.</span>'}
      <button type="button" data-accion="lista">Volver</button></div></section>`);
}

function pantallaBaja() {
  mostrar(`<section class="tarjeta"><h2>Dar de baja</h2>
    <p>La caja se conservará 30 días y se borrará la primera vez que abras la app pasado ese plazo. Exporta antes lo que necesites.</p>
    <div class="fila-botones"><button type="button" class="peligro" data-accion="baja-confirmar">Dar de baja</button><button type="button" data-accion="lista">Cancelar</button></div></section>`);
}

// ---------- acciones ----------
const acciones = {
  async login() {
    try {
      await app.iniciarSesion();
      pantallaCaja(await app.iniciar());
    } catch (e) { estado(mensajeError(e), true); }
  },
  'volver-abrir': async () => pantallaCaja(await app.iniciar()),
  'emergencia-entrar': () => pantallaEmergenciaEntrar(),
  nueva: () => pantallaFormulario(),
  lista: () => pantallaLista(),
  abrir: (el) => pantallaDetalle(el.dataset.id),
  ver: (el) => pantallaDetalle(el.dataset.id, caja().ver(el.dataset.id)),
  copiar: (el) => { caja().copiar(el.dataset.id, portapapeles); estado('Copiada. Se borrará del portapapeles en 30 segundos.'); },
  editar: (el) => pantallaFormulario(el.dataset.id),
  async renovar(el) {
    const nueva = caja().generar();
    caja().renovar(el.dataset.id, nueva);
    await persistir();
    pantallaDetalle(el.dataset.id, nueva);
    estado('Contraseña nueva generada. Cámbiala en el sitio y pulsa «La nueva funciona». La anterior se conserva 5 días.');
  },
  async 'confirmar-renovacion'(el) { caja().confirmarRenovacion(el.dataset.id); await persistir(); pantallaDetalle(el.dataset.id); },
  async borrar(el) {
    if (!globalThis.confirm('¿Borrar esta entrada?')) return;
    caja().borrar(el.dataset.id); await persistir(); pantallaLista();
  },
  generar() {
    const longitud = Number($('#longitud').value);
    $('#contrasena').value = caja().generar({ longitud });
  },
  'renovar-varias': () => pantallaRenovarVarias(),
  excel() { descargar('contrasenas-caducidad.xlsx', caja().exportarExcel(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); persistir(); estado('Excel generado: sin contraseñas.'); },
  ics() { descargar('contrasenas-caducidad.ics', caja().exportarIcs(), 'text/calendar'); persistir(); estado('Calendario generado: sin contraseñas.'); },
  registro: () => pantallaRegistro(),
  emergencia: () => pantallaEmergencia(),
  async 'generar-emergencia'() { const k = await caja().generarClaveEmergencia(); await persistir(); pantallaEmergencia(k); },
  imprimir: () => globalThis.print(),
  baja: () => pantallaBaja(),
  async 'baja-confirmar'() { await app.darDeBaja(); infoBaja = new Date().toISOString(); estado('Caja dada de baja.'); pantallaLista(); },
  async sincronizar() {
    estado('Sincronizando…');
    const ok = await app.sincronizar();
    if (ok) { estado('Sincronizado con tu Google Drive.'); pantallaLista(); }
    else estado('No se ha podido sincronizar. Tus cambios siguen aquí: pulsa «Reconectar» y vuelve a intentarlo.', true);
  },
  'face-id': () => pantallaFaceId(),
  async 'activar-face-id'() {
    const { id, secreto } = await biometria.registrar();
    if (!secreto) { bioPendiente = id; estado('Passkey creada. Pulsa «Terminar activación» y confirma con Face ID.'); await pantallaFaceId(); return; }
    await app.activarBiometria(id, secreto);
    estado('Face ID activado en este dispositivo.'); await pantallaFaceId();
  },
  async 'terminar-face-id'() {
    const { id, secreto } = await biometria.leer(bioPendiente);
    bioPendiente = null;
    await app.activarBiometria(id, secreto);
    estado('Face ID activado en este dispositivo.'); await pantallaFaceId();
  },
  async 'quitar-face-id'(el) {
    if (!globalThis.confirm('¿Quitar Face ID de este dispositivo?')) return;
    await app.quitarBiometria(el.dataset.id);
    estado('Dispositivo quitado.'); await pantallaFaceId();
  },
  async 'entrar-face-id'() {
    const { id, secreto } = await biometria.leer();
    await app.abrirCajaBiometria(id, secreto);
    estado(''); pantallaLista();
  },
  async reconectar() {
    try { await app.iniciarSesion(); await persistir(); } catch (e) { estado(mensajeError(e), true); }
  },
  cerrar() { app.cerrar(); pantallaLogin(); estado('Caja cerrada.'); },
};

// ---------- formularios ----------
const formularios = {
  async crear(f) {
    const d = new FormData(f);
    if (d.get('maestra') !== d.get('maestra2')) throw new DatoInvalido('Las dos contraseñas maestras no coinciden.');
    await app.crearCaja(d.get('maestra'));
    await persistir();
    pantallaLista();
  },
  async abrir(f) { await app.abrirCaja(new FormData(f).get('maestra')); estado(''); pantallaLista(); },
  async 'abrir-emergencia'(f) { await app.abrirCajaEmergencia(new FormData(f).get('clave')); estado('Has entrado con la clave de emergencia.'); pantallaLista(); },
  async guardar(f) {
    const d = new FormData(f);
    const id = f.dataset.id;
    const dias = Number(d.get('dias'));
    const contrasena = d.get('contrasena');
    if (id) {
      const cambios = { sitio: d.get('sitio'), usuario: d.get('usuario'), tipo: d.get('tipo'), caducaDias: dias };
      if (contrasena) cambios.contrasena = contrasena;
      caja().actualizar(id, cambios);
      caja().programarAviso(id, Number(d.get('aviso')));
      if (contrasena) deshacerHasta = Date.now() + 20000;
    } else {
      const e = caja().guardar(d.get('sitio'), d.get('usuario'), contrasena, dias, { tipo: d.get('tipo') });
      caja().programarAviso(e.id, Number(d.get('aviso')));
    }
    await persistir();
    pantallaLista();
  },
  async 'renovar-varias'(f, evento) {
    const ids = new FormData(f).getAll('id');
    const confirmar = evento.submitter && evento.submitter.dataset.modo === 'confirmar';
    const informe = caja().renovarVarias(ids, { confirmar });
    if (!confirmar) { pantallaRenovarVarias(informe, ids); return; }
    await persistir();
    estado(`${informe.cambios} contraseñas renovadas. Cámbialas en cada sitio; las anteriores se conservan 5 días.`);
    pantallaLista();
  },
  async 'confirmar-emergencia'() { caja().confirmarClaveEmergencia(); await persistir(); estado('Clave de emergencia confirmada.'); pantallaLista(); },
};

// ---------- eventos ----------
vista.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion]');
  if (!el || !acciones[el.dataset.accion]) return;
  try { await acciones[el.dataset.accion](el); } catch (e) { estado(mensajeError(e), true); }
});
$('#cerrar').addEventListener('click', () => acciones.cerrar());

vista.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const accion = formularios[f.dataset.form];
  if (!accion) return;
  try { await accion(f, ev); } catch (e) { estado(mensajeError(e), true); }
  if (['crear', 'abrir', 'abrir-emergencia'].includes(f.dataset.form) && f.isConnected) f.reset(); // no dejar la maestra en pantalla
});

vista.addEventListener('input', (ev) => {
  if (ev.target.id !== 'buscar') return;
  filtro.buscar = ev.target.value;
  $('#resultado').innerHTML = listaHtml(caja().listar(filtro));
});
vista.addEventListener('change', (ev) => {
  if (ev.target.id !== 'filtro') return;
  filtro.estado = ev.target.value;
  $('#resultado').innerHTML = listaHtml(caja().listar(filtro));
});

// Cada segundo: borra el portapapeles a los 30 s y muestra el boton Deshacer durante 20 s.
setInterval(() => {
  portapapeles.tick();
  const barra = $('#deshacer');
  const resto = Math.ceil((deshacerHasta - Date.now()) / 1000);
  if (resto > 0 && app.caja) {
    barra.classList.remove('oculto');
    barra.innerHTML = `<span>Contraseña cambiada.</span><button type="button" id="boton-deshacer">Deshacer (${resto} s)</button>`;
  } else if (!barra.classList.contains('oculto')) {
    barra.classList.add('oculto'); barra.innerHTML = '';
  }
}, 1000);

$('#deshacer').addEventListener('click', async (ev) => {
  if (!ev.target.closest('#boton-deshacer')) return;
  try { caja().deshacer(); deshacerHasta = 0; await persistir(); pantallaLista(); } catch (e) { estado(mensajeError(e), true); }
});

pantallaLogin();
