// Caja de contraseñas: todo ocurre en memoria y se cifra al guardar (contenedor()).
// Contenedor (lo unico que sale del navegador): {v, iter, salM, kM, salE, kE, datos, bajaEl}
//   kM / kE = la clave de datos cifrada con la maestra / con la clave de emergencia.
//   datos   = entradas y registro, cifrados con la clave de datos (AES-GCM).
// Nunca se guarda la contraseña maestra.
import { ITERACIONES_POR_DEFECTO, aleatorio, aTexto, b64, claveDesdeBytes, cifrar, deTexto, deb64, derivar, descifrar, enteroAleatorio } from './cripto.js';
import { aExcel, aIcs } from './exportar.js';

export class AccesoDenegado extends Error {}
export class DatoInvalido extends Error {}
export class LimiteExcedido extends Error {}
export class DeshacerNoDisponible extends Error {}

const LIMITE_RENOVAR = 15;        // maximo de cambios en una renovacion multiple (C24)
const SEGUNDOS_DESHACER = 20;     // margen para deshacer (C25)
const DIAS_ANTERIOR = 5;          // la contraseña anterior se conserva 5 dias sin confirmar (C16)
const DIAS_REGISTRO = 365;        // el registro se conserva 12 meses (C26)
const AVISO_POR_DEFECTO = 7;      // dias de antelacion del aviso (C2)
const MIN_LONGITUD = 12;
const LONGITUD_POR_DEFECTO = 20;
const MIN_MAESTRA = 12;
const DIA_MS = 86400000;
const ITER_MIN = 1000;            // rango admitido de iteraciones PBKDF2 al abrir una caja (C38)
const ITER_MAX = 5000000;
const DIAS_BORRADAS = 90;         // cuanto se recuerda un borrado para que no reaparezca al sincronizar
const TIPOS = {
  minusculas: 'abcdefghijklmnopqrstuvwxyz',
  mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digitos: '0123456789',
  simbolos: '!@#$%^&*()-_=+[]{}:,.?',
};
const ALFABETO_EMERGENCIA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para leerla en papel

const sumarDias = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DIA_MS);
const normClave = (c) => String(c).replace(/[-\s]/g, '').toUpperCase();
const elegir = (cadena) => cadena[enteroAleatorio(cadena.length)];

// ---------- crear y abrir ----------
export async function crear(maestra, { reloj, iteraciones = ITERACIONES_POR_DEFECTO }) {
  if (typeof maestra !== 'string' || maestra.length < MIN_MAESTRA) {
    throw new DatoInvalido(`La contraseña maestra debe tener al menos ${MIN_MAESTRA} caracteres.`);
  }
  const k = aleatorio(32);
  const sal = aleatorio(16);
  const contenedor = {
    v: 1, iter: iteraciones, salM: b64(sal), kM: await cifrar(await derivar(maestra, sal, iteraciones), k),
    salE: null, kE: null, datos: '', bajaEl: null,
  };
  return new Caja(reloj, contenedor, k, await claveDesdeBytes(k), { entradas: {}, n: 0, registro: [] });
}

async function abrirCon(texto, secreto, saltKey, kKey, { reloj }) {
  let c;
  try { c = JSON.parse(texto); } catch { throw new AccesoDenegado('No se pudo abrir la caja.'); }
  if (!c || !c[kKey] || !c[saltKey] || !Number.isInteger(c.iter) || c.iter < ITER_MIN || c.iter > ITER_MAX) throw new AccesoDenegado('No se pudo abrir la caja.');
  try {
    const k = await descifrar(await derivar(secreto, deb64(c[saltKey]), c.iter), c[kKey]);
    const claveDatos = await claveDesdeBytes(k);
    const datos = JSON.parse(aTexto(await descifrar(claveDatos, c.datos)));
    return new Caja(reloj, c, k, claveDatos, datos);
  } catch {
    throw new AccesoDenegado('No se pudo abrir la caja.');
  }
}

// C35, C36: abrir con el secreto que da Face ID (el dispositivo ya verifico al usuario).
export async function abrirBiometria(texto, id, secreto, { reloj }) {
  const denegar = () => new AccesoDenegado('No se pudo abrir la caja.');
  let c;
  try { c = JSON.parse(texto); } catch { throw denegar(); }
  const reg = ((c && c.bio) || []).find((b) => b.id === id);
  if (!reg || !(secreto instanceof Uint8Array) || secreto.length !== 32) throw denegar();
  try {
    const k = await descifrar(await claveDesdeBytes(secreto), reg.k);
    const claveDatos = await claveDesdeBytes(k);
    const datos = JSON.parse(aTexto(await descifrar(claveDatos, c.datos)));
    return new Caja(reloj, c, k, claveDatos, datos);
  } catch { throw denegar(); }
}

export const abrir = (texto, maestra, opciones) => abrirCon(texto, maestra, 'salM', 'kM', opciones);
export const abrirEmergencia = (texto, clave, opciones) => abrirCon(texto, normClave(clave), 'salE', 'kE', opciones);

export class Caja {
  constructor(reloj, contenedor, k, claveDatos, datos) {
    this._reloj = reloj;
    this._c = contenedor;
    this._k = k;
    this._claveDatos = claveDatos;
    this._datos = datos;
    this._deshacer = null;
    this._abierta = true;
    this.emergenciaPendiente = false;
  }

  // ---------- interno ----------
  _ok() { if (!this._abierta) throw new AccesoDenegado('La caja está cerrada.'); }
  _hoy() { return this._reloj.ahora().toISOString().slice(0, 10); }
  _tocar(e) { e.mod = this._reloj.ahora().toISOString(); } // fecha del ultimo cambio: decide quien gana al sincronizar
  _entrada(id) {
    const e = this._datos.entradas[id];
    if (!e) throw new DatoInvalido('No existe esa entrada.');
    return e;
  }
  _estado(e) {
    if (e.revisar) return 'Revisar';
    const dias = diasEntre(this._hoy(), e.caduca);
    if (dias < 0) return 'Caducada';
    return dias <= e.aviso ? 'Por caducar' : 'Vigente';
  }
  _publica(e) {
    return { id: e.id, sitio: e.sitio, usuario: e.usuario, tipo: e.tipo, caduca: e.caduca, estado: this._estado(e), avisoDias: e.aviso };
  }

  // Registro de acciones: nunca lleva contraseñas, solo la accion, la fecha y el id de la entrada.
  anotar(accion, detalle = '') {
    this._datos.registro.push({ accion, fecha: this._reloj.ahora().toISOString(), detalle });
    this._purgarRegistro();
  }
  _purgarRegistro() {
    const limite = new Date(this._reloj.ahora().getTime() - DIAS_REGISTRO * DIA_MS).toISOString();
    this._datos.registro = this._datos.registro.filter((r) => r.fecha >= limite);
  }
  registro() {
    this._ok();
    this._purgarRegistro();
    return this._datos.registro.map((r) => ({ ...r }));
  }

  cerrar() { this._abierta = false; this._datos = null; this._k = null; }

  // Lo unico que sale del navegador: texto cifrado.
  async contenedor() {
    this._ok();
    this._c.datos = await cifrar(this._claveDatos, deTexto(JSON.stringify(this._datos)));
    return JSON.stringify(this._c);
  }

  // ---------- C35-C38: Face ID ----------
  // bio = [{id, k}]: k es la clave de datos cifrada con el secreto del dispositivo. bioQuitadas evita que reaparezcan al fusionar.
  async activarBiometria(id, secreto) {
    this._ok();
    if (!id || !(secreto instanceof Uint8Array) || secreto.length !== 32) throw new DatoInvalido('Face ID no válido.');
    const k = await cifrar(await claveDesdeBytes(secreto), this._k);
    this._c.bio = [...(this._c.bio || []).filter((b) => b.id !== id), { id, k }];
    this._c.bioQuitadas = (this._c.bioQuitadas || []).filter((x) => x !== id);
    this.anotar('face_id_activado');
  }

  quitarBiometria(id) {
    this._ok();
    this._c.bio = (this._c.bio || []).filter((b) => b.id !== id);
    if (!(this._c.bioQuitadas || []).includes(id)) this._c.bioQuitadas = [...(this._c.bioQuitadas || []), id];
    this.anotar('face_id_quitado');
  }

  listarBiometria() {
    this._ok();
    return (this._c.bio || []).map((b) => b.id);
  }

  // ---------- C31-C34: fusionar con la copia de Drive ----------
  // Entradas: gana la modificacion mas reciente; lo borrado en un sitio se borra en el otro.
  // Si el texto no se puede descifrar con la clave de esta caja, lanza AccesoDenegado y no cambia nada.
  async fusionar(texto) {
    this._ok();
    let remoto;
    try {
      const c = JSON.parse(texto);
      remoto = JSON.parse(aTexto(await descifrar(this._claveDatos, c.datos)));
      this._remotoC = c;
    } catch { throw new AccesoDenegado('La caja de Drive no se puede abrir con esta clave. No se ha sobrescrito.'); }
    const local = this._datos;
    const borradas = { ...(remoto.borradas || {}) };
    for (const [id, f] of Object.entries(local.borradas || {})) if (!borradas[id] || borradas[id] < f) borradas[id] = f;
    const limite = new Date(this._reloj.ahora().getTime() - DIAS_BORRADAS * DIA_MS).toISOString();
    for (const id of Object.keys(borradas)) if (borradas[id] < limite) delete borradas[id];
    let cambios = 0;
    const entradas = { ...local.entradas };
    for (const [id, r] of Object.entries(remoto.entradas || {})) {
      const l = entradas[id];
      if (!l) { entradas[id] = r; cambios++; } else if ((r.mod || '') > (l.mod || '')) { entradas[id] = r; cambios++; }
    }
    for (const [id, f] of Object.entries(borradas)) {
      if (entradas[id] && (entradas[id].mod || '') <= f) { delete entradas[id]; cambios++; }
    }
    const vistos = new Set();
    local.registro = [...local.registro, ...(remoto.registro || [])]
      .filter((r) => { const k = r.fecha + '|' + r.accion + '|' + r.detalle; if (vistos.has(k)) return false; vistos.add(k); return true; })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    local.entradas = entradas;
    local.borradas = borradas;
    local.n = Math.max(local.n, remoto.n || 0);
    const quitadas = new Set([...(this._c.bioQuitadas || []), ...(this._remotoC.bioQuitadas || [])]);
    const bio = new Map([...(this._remotoC.bio || []), ...(this._c.bio || [])].map((b) => [b.id, b]));
    this._c.bio = [...bio.values()].filter((b) => !quitadas.has(b.id));
    this._c.bioQuitadas = [...quitadas];
    if (this._remotoC.salE && (!this._c.salE || (this._remotoC.emerEl || '') > (this._c.emerEl || ''))) {
      this._c.salE = this._remotoC.salE; this._c.kE = this._remotoC.kE; this._c.emerEl = this._remotoC.emerEl;
    }
    if (!this._c.bajaEl && this._remotoC.bajaEl) this._c.bajaEl = this._remotoC.bajaEl;
    this._remotoC = null;
    this._purgarRegistro();
    return { cambios };
  }

  // ---------- C1, C12: guardar, editar, borrar ----------
  guardar(sitio, usuario, contrasena, caducaDias, { tipo = 'Otro' } = {}) {
    this._ok();
    if (!sitio || !usuario || !contrasena) throw new DatoInvalido('Sitio, usuario y contraseña son obligatorios.');
    if (!Number.isInteger(caducaDias)) throw new DatoInvalido('La caducidad debe ser un número de días.');
    this._datos.n += 1;
    const id = 'e' + Array.from(aleatorio(6), (b) => b.toString(16).padStart(2, '0')).join(''); // unico entre dispositivos
    this._datos.entradas[id] = {
      id, mod: this._reloj.ahora().toISOString(), sitio, usuario, contrasena, tipo: tipo || 'Otro', dias: caducaDias,
      caduca: sumarDias(this._hoy(), caducaDias),
      revisar: caducaDias <= 0,   // C15: fecha imposible -> se guarda y se marca
      aviso: AVISO_POR_DEFECTO, anterior: null, anteriorHasta: null,
    };
    this.anotar('alta', id);
    return this._publica(this._datos.entradas[id]);
  }

  actualizar(id, { sitio, usuario, contrasena, tipo, caducaDias } = {}) {
    this._ok();
    const e = this._entrada(id);
    if (contrasena !== undefined) { // guarda lo anterior para poder deshacer 20 s (C4)
      this._deshacer = { id, previa: { ...e }, hasta: this._reloj.ahora().getTime() + SEGUNDOS_DESHACER * 1000 };
    }
    this._tocar(e);
    for (const [campo, valor] of Object.entries({ sitio, usuario, contrasena, tipo })) {
      if (valor === undefined) continue;
      if (valor === '') throw new DatoInvalido(`El campo ${campo} no puede quedar vacío.`);
      e[campo] = valor;
    }
    if (caducaDias !== undefined) {
      e.dias = caducaDias;
      e.caduca = sumarDias(this._hoy(), caducaDias);
      e.revisar = caducaDias <= 0;
    }
    this.anotar('cambio', id);
    return this._publica(e);
  }

  borrar(id) {
    this._ok();
    this._entrada(id);
    delete this._datos.entradas[id];
    (this._datos.borradas ||= {})[id] = this._reloj.ahora().toISOString();
    this.anotar('borrado', id);
  }

  // ---------- C4, C25: deshacer ----------
  deshacer() {
    this._ok();
    if (!this._deshacer || this._reloj.ahora().getTime() > this._deshacer.hasta) throw new DeshacerNoDisponible('Ya no se puede deshacer.');
    this._datos.entradas[this._deshacer.id] = this._deshacer.previa;
    this._tocar(this._deshacer.previa);
    this.anotar('deshacer', this._deshacer.id);
    this._deshacer = null;
  }

  // ---------- C9: listar, buscar, filtrar ----------
  listar({ buscar, estado } = {}) {
    this._ok();
    const b = buscar ? buscar.toLowerCase() : null;
    return Object.values(this._datos.entradas)
      .filter((e) => !b || e.sitio.toLowerCase().includes(b) || e.usuario.toLowerCase().includes(b))
      .map((e) => this._publica(e))
      .filter((e) => !estado || e.estado === estado)
      .sort((x, y) => (x.caduca + x.sitio).localeCompare(y.caduca + y.sitio));
  }

  mensajeVacio() { return 'Aún no tienes contraseñas guardadas'; }

  // ---------- C8: ver y copiar ----------
  ver(id) {
    this._ok();
    const c = this._entrada(id).contrasena;
    this.anotar('ver_contrasena', id);
    return c;
  }

  copiar(id, portapapeles) {
    this._ok();
    portapapeles.copiar(this._entrada(id).contrasena);
    this.anotar('copiar_contrasena', id);
  }

  // ---------- C2: avisos ----------
  programarAviso(id, dias) {
    this._ok();
    if (!Number.isInteger(dias) || dias < 0 || dias > 365) throw new DatoInvalido('La antelación debe estar entre 0 y 365 días.');
    const e = this._entrada(id);
    e.aviso = dias;
    this._tocar(e);
  }

  avisos() {
    this._ok();
    const motivos = { Caducada: 'caducada', 'Por caducar': 'proxima' };
    return this.listar().filter((e) => motivos[e.estado]).map((e) => ({ id: e.id, sitio: e.sitio, motivo: motivos[e.estado] }));
  }

  // ---------- C17: duplicados ----------
  avisosDuplicados() {
    this._ok();
    const entradas = Object.values(this._datos.entradas);
    const grupos = (clave) => {
      const m = new Map();
      for (const e of entradas) m.set(clave(e), [...(m.get(clave(e)) || []), e.sitio]);
      return [...m.values()].filter((s) => s.length > 1);
    };
    return [
      ...grupos((e) => e.contrasena).map((sitios) => ({ tipo: 'contrasena_repetida', sitios })),
      ...grupos((e) => e.sitio.toLowerCase() + '|' + e.usuario.toLowerCase()).map((sitios) => ({ tipo: 'usuario_repetido', sitios })),
    ];
  }

  // ---------- C3: generar ----------
  generar({ longitud = LONGITUD_POR_DEFECTO, tipos = Object.keys(TIPOS) } = {}) {
    this._ok();
    if (!Number.isInteger(longitud) || longitud < MIN_LONGITUD || longitud > 128) throw new DatoInvalido(`La longitud debe estar entre ${MIN_LONGITUD} y 128.`);
    if (!tipos.length || tipos.some((t) => !TIPOS[t])) throw new DatoInvalido('Tipos de carácter no válidos.');
    const todos = tipos.map((t) => TIPOS[t]).join('');
    const c = tipos.map((t) => elegir(TIPOS[t])); // al menos uno de cada tipo
    while (c.length < longitud) c.push(elegir(todos));
    for (let i = c.length - 1; i > 0; i--) { const j = enteroAleatorio(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
    return c.join('');
  }

  // ---------- C16: renovar ----------
  renovar(id, nueva) {
    this._ok();
    const e = this._entrada(id);
    if (!nueva) throw new DatoInvalido('La nueva contraseña no puede estar vacía.');
    const sinConfirmar = e.anterior !== null && this._reloj.ahora().toISOString() < e.anteriorHasta;
    if (!sinConfirmar) e.anterior = e.contrasena; // si ya hay una renovacion sin confirmar, se conserva la original
    e.anteriorHasta = new Date(this._reloj.ahora().getTime() + DIAS_ANTERIOR * DIA_MS).toISOString();
    this._tocar(e);
    e.contrasena = nueva;
    if (e.dias > 0) e.caduca = sumarDias(this._hoy(), e.dias);
    this.anotar('renovacion', id);
  }

  contrasenaAnterior(id) {
    this._ok();
    const e = this._entrada(id);
    if (e.anterior === null) return null;
    if (this._reloj.ahora().toISOString() >= e.anteriorHasta) { e.anterior = null; e.anteriorHasta = null; return null; } // pasaron 5 dias
    return e.anterior;
  }

  confirmarRenovacion(id) {
    this._ok();
    const e = this._entrada(id);
    e.anterior = null; e.anteriorHasta = null;
    this._tocar(e);
    this.anotar('renovacion_confirmada', id);
  }

  // ---------- C10, C24: renovar varias (nivel 2: en seco, tope, confirmacion) ----------
  renovarVarias(ids, { confirmar = false } = {}) {
    this._ok();
    ids = [...new Set(ids)];
    if (ids.length > LIMITE_RENOVAR) throw new LimiteExcedido(`Se pueden renovar como máximo ${LIMITE_RENOVAR} a la vez.`);
    ids.forEach((i) => this._entrada(i));
    if (!confirmar) { this.anotar('prueba_en_seco', String(ids.length)); return { cambios: ids.length, aplicado: false }; }
    ids.forEach((i) => this.renovar(i, this.generar()));
    return { cambios: ids.length, aplicado: true };
  }

  // ---------- C6, C18: clave de emergencia ----------
  // Devuelve la clave una sola vez. La anterior deja de valer. Nunca se envia por correo.
  async generarClaveEmergencia() {
    this._ok();
    let clave = '';
    for (let i = 0; i < 24; i++) clave += elegir(ALFABETO_EMERGENCIA);
    const sal = aleatorio(16);
    this._c.salE = b64(sal);
    this._c.kE = await cifrar(await derivar(clave, sal, this._c.iter), this._k);
    this._c.emerEl = this._reloj.ahora().toISOString();
    this.emergenciaPendiente = true;
    this.anotar('clave_emergencia_generada');
    return clave.match(/.{4}/g).join('-');
  }

  confirmarClaveEmergencia() {
    this._ok();
    this.emergenciaPendiente = false;
    this.anotar('clave_emergencia_confirmada');
  }

  // ---------- C5, C7, C23: exportaciones sin contraseñas ----------
  exportarExcel() {
    this._ok();
    const bytes = aExcel(this.listar().map((e) => [e.sitio, e.usuario, e.tipo, e.caduca]));
    this.anotar('exportacion', 'excel');
    return bytes;
  }

  exportarIcs() {
    this._ok();
    const ics = aIcs(this.listar().map((e) => ({ id: e.id, sitio: e.sitio, fecha: e.caduca })), this._reloj.ahora());
    this.anotar('exportacion', 'calendario');
    return ics;
  }

  // ---------- C19: baja ----------
  // La fecha va en claro en el contenedor para poder borrarla sin abrir la caja.
  darDeBaja() {
    this._ok();
    this._c.bajaEl = this._reloj.ahora().toISOString();
    this.anotar('baja');
  }
}
