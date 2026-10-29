// Aplicacion: une el login de Google, el almacen (Drive) y la caja.
//   identidad.iniciarSesion() -> {usuario, token}     (en el navegador: login de Google)
//   crearAlmacen(sesion)      -> {leer, escribir, borrar}   (en el navegador: AlmacenDrive)
// Sin login y sin la contraseña maestra (o la clave de emergencia) no se puede ver ningun dato.
import { AccesoDenegado, DatoInvalido, abrir, abrirBiometria, abrirEmergencia, crear } from './caja.js';
import { ITERACIONES_POR_DEFECTO } from './cripto.js';

const DIAS_BAJA = 30;           // la caja dada de baja se conserva 30 dias (C19)
const DIA_MS = 86400000;

export class Aplicacion {
  constructor({ identidad, crearAlmacen, reloj, iteraciones = ITERACIONES_POR_DEFECTO }) {
    this._identidad = identidad;
    this._crearAlmacen = crearAlmacen;
    this._reloj = reloj;
    this._iteraciones = iteraciones;
    this.sesion = null;
    this.caja = null;
    this.pendiente = false;   // hay cambios sin guardar en Drive (C30)
  }

  _requiereSesion() {
    if (!this.sesion) throw new AccesoDenegado('Inicia sesión con Google.');
  }

  async iniciarSesion() {
    try {
      this.sesion = await this._identidad.iniciarSesion();
    } catch {
      throw new AccesoDenegado('No se pudo iniciar sesión con Google.');
    }
    this._almacen = this._crearAlmacen(this.sesion);
    return this.sesion;
  }

  // Primera comprobacion tras el login: borra la caja si lleva mas de 30 dias dada de baja (C19).
  async iniciar() {
    this._requiereSesion();
    const texto = await this._almacen.leer();
    if (!texto) return { hayCaja: false };
    let baja = null;
    let tieneBio = false;
    try { const c = JSON.parse(texto); baja = c.bajaEl; tieneBio = Array.isArray(c.bio) && c.bio.length > 0; } catch { baja = null; }
    if (baja && this._reloj.ahora().getTime() - Date.parse(baja) >= DIAS_BAJA * DIA_MS) {
      await this._almacen.borrar();
      return { hayCaja: false, borrada: true };
    }
    return { hayCaja: true, baja, tieneBio };
  }

  async crearCaja(maestra) {
    this._requiereSesion();
    if (await this._almacen.leer()) throw new DatoInvalido('Ya tienes una caja creada.');
    this.caja = await crear(maestra, { reloj: this._reloj, iteraciones: this._iteraciones });
    this.caja.anotar('inicio_sesion');
    this.caja.anotar('caja_creada');
    return this.caja;
  }

  async _abrirCon(abridor, secreto, accion) {
    this._requiereSesion();
    const texto = await this._almacen.leer();
    if (!texto) throw new AccesoDenegado('No se pudo abrir la caja.');
    this.caja = await abridor(texto, secreto, { reloj: this._reloj });
    this.caja.anotar('inicio_sesion');
    if (accion) this.caja.anotar(accion);
    return this.caja;
  }

  abrirCaja(maestra) { return this._abrirCon(abrir, maestra); }
  abrirCajaBiometria(id, secreto) { return this._abrirCon((t, s, o) => abrirBiometria(t, id, s, o), secreto, 'acceso_con_face_id'); }
  abrirCajaEmergencia(clave) { return this._abrirCon(abrirEmergencia, clave, 'acceso_con_clave_emergencia'); }

  // Cifra y envia la caja. Antes trae lo de Drive y lo fusiona (C31-C34).
  // Si falla (sin conexion, sesion caducada, caja ajena), el cambio sigue en memoria y no se sobrescribe nada (C30).
  async guardar() {
    if (!this.caja) return false;
    try {
      const remoto = await this._almacen.leer();
      if (remoto) await this.caja.fusionar(remoto);
      await this._almacen.escribir(await this.caja.contenedor());
      this.pendiente = false;
      return true;
    } catch {
      this.pendiente = true;
      return false;
    }
  }

  // Boton «Sincronizar»: trae los cambios de otros dispositivos y sube los propios.
  async sincronizar() {
    this._requiereSesion();
    return this.guardar();
  }

  // Face ID (C35-C37): se activa y se quita con la caja ya abierta; se guarda en la caja cifrada de Drive.
  async activarBiometria(id, secreto) {
    this._requiereSesion();
    await this.caja.activarBiometria(id, secreto);
    return this.guardar();
  }

  async quitarBiometria(id) {
    this._requiereSesion();
    this.caja.quitarBiometria(id);
    return this.guardar();
  }

  async darDeBaja() {
    this._requiereSesion();
    this.caja.darDeBaja();
    return this.guardar();
  }

  cerrar() {
    if (this.caja) this.caja.cerrar();
    this.caja = null;
  }
}
