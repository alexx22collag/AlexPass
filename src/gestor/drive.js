// Almacen en Google Drive, SOLO en la carpeta oculta de la app (appDataFolder).
// Un unico permiso: drive.appdata. La app no puede ver ningun otro fichero del Drive.
export const ALCANCE = 'https://www.googleapis.com/auth/drive.appdata';
const NOMBRE = 'caja.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
const FRONTERA = 'frontera-gestor-contrasenas';

export class AlmacenDrive {
  constructor(token, fetchFn = (...a) => globalThis.fetch(...a)) {
    this._token = token;
    this._fetch = fetchFn;
    this._id = null;
  }

  async _llamar(url, opciones = {}) {
    const r = await this._fetch(url, { ...opciones, headers: { Authorization: `Bearer ${this._token}`, ...(opciones.headers || {}) } });
    if (!r.ok && r.status !== 404) throw new Error('No se pudo comunicar con Google Drive.');
    return r;
  }

  async _buscar() {
    const q = encodeURIComponent(`name='${NOMBRE}'`);
    const r = await this._llamar(`${API}?spaces=appDataFolder&q=${q}&fields=files(id)`);
    const datos = await r.json();
    this._id = datos.files && datos.files.length ? datos.files[0].id : null;
    return this._id;
  }

  async leer() {
    const id = this._id || await this._buscar();
    if (!id) return null;
    const r = await this._llamar(`${API}/${id}?alt=media`);
    if (r.status === 404) { this._id = null; return null; }
    return r.text();
  }

  async escribir(texto) {
    const id = this._id || await this._buscar();
    if (id) {
      await this._llamar(`${SUBIDA}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: texto });
      return;
    }
    const meta = JSON.stringify({ name: NOMBRE, parents: ['appDataFolder'] });
    const cuerpo = `--${FRONTERA}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`
      + `--${FRONTERA}\r\nContent-Type: application/json\r\n\r\n${texto}\r\n--${FRONTERA}--`;
    const r = await this._llamar(`${SUBIDA}?uploadType=multipart`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${FRONTERA}` }, body: cuerpo });
    this._id = (await r.json()).id;
  }

  async borrar() {
    const id = this._id || await this._buscar();
    if (id) await this._llamar(`${API}/${id}`, { method: 'DELETE' });
    this._id = null;
  }
}
