// Portapapeles que se vacia solo a los 30 segundos. `escribir(texto)` lo aporta el navegador
// (navigator.clipboard.writeText) o los tests; `tick()` lo llama un temporizador cada segundo.
export const SEGUNDOS_PORTAPAPELES = 30;

export class Portapapeles {
  constructor(reloj, escribir) {
    this._reloj = reloj;
    this._escribir = escribir;
    this._expira = null;
  }

  copiar(texto) {
    this._escribir(texto);
    this._expira = this._reloj.ahora().getTime() + SEGUNDOS_PORTAPAPELES * 1000;
  }

  tick() {
    if (this._expira !== null && this._reloj.ahora().getTime() >= this._expira) {
      this._escribir('');
      this._expira = null;
    }
  }
}
