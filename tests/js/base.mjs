// Utilidades comunes de los tests. Solo datos ficticios (@example.com, contrasenas inventadas).
import { Aplicacion } from '../../src/gestor/aplicacion.js';
import { AlmacenMemoria } from '../../src/gestor/almacen.js';

export const MAESTRA = 'Maestra-Ficticia-1';
export const ITER = 1000; // iteraciones bajas solo para que los tests vayan rapido

// Reloj controlable: los tests avanzan el tiempo sin esperar.
export class RelojFalso {
  constructor() { this.t = new Date('2026-01-15T09:00:00Z'); }
  ahora() { return new Date(this.t); }
  avanzar({ days = 0, hours = 0, minutes = 0, seconds = 0 } = {}) {
    this.t = new Date(this.t.getTime() + (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000);
  }
}

// Identidad ficticia: sustituye al login de Google.
export class IdentidadFalsa {
  constructor(usuario, ok = true) { this.usuario = usuario; this.ok = ok; }
  async iniciarSesion() {
    if (!this.ok) throw new Error('rechazado');
    return { usuario: this.usuario, token: 'xxx-ficticio' };
  }
}

// Una app con su propio "Drive" (mapa usuario -> texto cifrado). Varias apps pueden compartir el mapa.
export function nuevaApp(reloj, mapa, usuario = 'usuario1@example.com', ok = true) {
  return new Aplicacion({
    identidad: new IdentidadFalsa(usuario, ok),
    crearAlmacen: (sesion) => new AlmacenMemoria(mapa, sesion.usuario),
    reloj, iteraciones: ITER,
  });
}

// Entorno estandar: sesion iniciada y caja creada y abierta.
export async function nuevo() {
  const reloj = new RelojFalso();
  const mapa = new Map();
  const app = nuevaApp(reloj, mapa);
  await app.iniciarSesion();
  const caja = await app.crearCaja(MAESTRA);
  return { reloj, mapa, app, caja };
}

export function anadir(caja, { sitio = 'Sitio Ejemplo', usuario = 'yo@example.com', contrasena = 'Ficticia-Aa1!xx', dias = 90, tipo = 'Otro' } = {}) {
  return caja.guardar(sitio, usuario, contrasena, dias, { tipo });
}
