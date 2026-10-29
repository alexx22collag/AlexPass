// Almacen ficticio en memoria (tests y pruebas). El real es AlmacenDrive (drive.js).
// Interfaz comun: leer() -> texto | null, escribir(texto), borrar().
export class AlmacenMemoria {
  constructor(mapa, clave) {
    this._mapa = mapa;
    this._clave = clave;
    this.fallar = false; // los tests lo activan para simular que no hay conexion
  }

  async leer() {
    return this._mapa.has(this._clave) ? this._mapa.get(this._clave) : null;
  }

  async escribir(texto) {
    if (this.fallar) throw new Error('sin conexion');
    this._mapa.set(this._clave, texto);
  }

  async borrar() {
    this._mapa.delete(this._clave);
  }
}
