// Login de Google (Google Identity Services, flujo de token en el navegador).
// Pide un unico permiso: guardar archivos propios de la app en Drive (drive.appdata).
import { ALCANCE } from './gestor/drive.js';

export function identidadGoogle(clientId) {
  return {
    iniciarSesion: () => new Promise((resolver, rechazar) => {
      const gsi = globalThis.google && globalThis.google.accounts && globalThis.google.accounts.oauth2;
      if (!gsi) { rechazar(new Error('El servicio de Google no ha cargado.')); return; }
      const cliente = gsi.initTokenClient({
        client_id: clientId,
        scope: ALCANCE,
        callback: (r) => (r.access_token ? resolver({ usuario: 'google', token: r.access_token }) : rechazar(new Error(r.error || 'rechazado'))),
        error_callback: (e) => rechazar(new Error(e && e.type ? e.type : 'cancelado')),
      });
      cliente.requestAccessToken();
    }),
  };
}
