// Aplicacion: une el login de Google, el almacen (Drive) y la caja.
//   identidad.iniciarSesion() -> {usuario, token}     (en el navegador: login de Google)
//   crearAlmacen(sesion)      -> {leer, escribir, borrar}   (en el navegador: AlmacenDrive)
// Sin login y sin la contraseña maestra (o la clave de emergencia) no se puede ver ningun dato.
import { AccesoDenegado, DatoInvalido, abrir, abrirEmergencia, crear } from './caja.js';
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
    try { baja = JSON.parse(texto).bajaEl; } catch { baja = null; }
    if (baja && this._reloj.ahora().getTime() - Date.parse(baja) >= DIAS_BAJA * DIA_MS) {
      await this._almacen.borrar();
      return { hayCaja: false, borrada: true };
    }
    return { hayCaja: true, baja };
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
  abrirCajaEmergencia(clave) { return this._abrirCon(abrirEmergencia, clave, 'acceso_con_clave_emergencia'); }

  // Cifra y envia la caja. Si falla (sin conexion, sesion caducada), el cambio sigue en memoria (C30).
  async guardar() {
    if (!this.caja) return false;
    try {
      await this._almacen.escribir(await this.caja.contenedor());
      this.pendiente = false;
      return true;
    } catch {
      this.pendiente = true;
      return false;
    }
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
