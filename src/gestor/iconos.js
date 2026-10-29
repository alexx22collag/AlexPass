// Icono automatico de cada contraseña, sin salir del navegador: se reconoce la marca por el nombre del sitio
// y, si no se reconoce, se dibuja un avatar con la inicial y un color estable. Nunca se consulta a ningun servicio.
import { MARCAS } from './marcas.js';
import { esc } from './vistas.js';

// Otras formas de escribir una marca -> clave en MARCAS.
const ALIAS = {
  twitter: 'x', fb: 'facebook', meta: 'facebook', insta: 'instagram', ig: 'instagram', yt: 'youtube', wa: 'whatsapp',
  amazonprime: 'amazon', aws: 'amazonwebservices', amazonaws: 'amazonwebservices', prime: 'amazon', drive: 'googledrive', maps: 'googlemaps',
  chrome: 'googlechrome', chatgpt: 'openai', claude: 'anthropic', amex: 'americanexpress', psn: 'playstation',
  epic: 'epicgames', ps: 'playstation', gdrive: 'googledrive', gcloud: 'googlecloud', ebayes: 'ebay', paypalcom: 'paypal',
};
// Palabras corrientes que tambien son marcas: solo cuentan si el nombre entero es esa palabra.
const AMBIGUAS = new Set(['line', 'medium', 'signal', 'wise', 'brave', 'opera', 'proton', 'orange', 'miro', 'sap', 'steam', 'nike', 'ea', 'x', 'ing', 'wire', 'tidal', 'ovh']);
const COLORES = ['#c2410c', '#b45309', '#4d7c0f', '#15803d', '#0f766e', '#0e7490', '#1d4ed8', '#4338ca', '#6d28d9', '#a21caf', '#be185d', '#be123c'];

const normalizar = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clave = (c) => (ALIAS[c] && MARCAS[ALIAS[c]] ? ALIAS[c] : (MARCAS[c] ? c : null)); // el alias manda sobre la clave

function hash(t) { let h = 7; for (const c of t) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; }

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Devuelve {marca, titulo, letra, color, texto}. marca es la clave de MARCAS o null.
export function iconoDe(sitio) {
  const nombre = normalizar(sitio || '');
  const palabras = nombre.split(/[^a-z0-9]+/).filter(Boolean);
  const todo = palabras.join('');
  let marca = null;
  if (palabras.length) {
    marca = clave(todo);
    for (let i = 0; !marca && i < palabras.length - 1; i++) marca = clave(palabras[i] + palabras[i + 1]);   // «google drive»
    for (let i = 0; !marca && i < palabras.length; i++) {
      const p = palabras[i];
      if (p.length < 3 && p !== todo) continue;                       // una letra suelta no es una marca
      if (AMBIGUAS.has(p) && palabras.length > 1) continue;
      marca = clave(p);
    }
  }
  const letra = (Array.from(String(sitio || '').trim().normalize('NFC')).find((c) => /[\p{L}\p{N}]/u.test(c)) || '?').toUpperCase();
  const color = marca ? '#' + MARCAS[marca].h : COLORES[hash(nombre) % COLORES.length];
  return { marca, titulo: marca ? MARCAS[marca].t : String(sitio || ''), letra, color, texto: luminancia(color) > 0.6 ? '#111111' : '#ffffff' };
}

// Avatar como SVG en linea. Los colores van como atributos del SVG (no como style="..."): la CSP no permite estilos en linea.
export function avatarHtml(sitio) {
  const i = iconoDe(sitio);
  const base = `<svg class="avatar" viewBox="0 0 40 40" role="img" aria-label="${esc(i.titulo)}"><rect width="40" height="40" rx="11" fill="${i.color}"/>`;
  if (i.marca) return `${base}<path transform="translate(8 8)" fill="${i.texto}" d="${MARCAS[i.marca].d}"/></svg>`;
  return `${base}<text x="20" y="27" text-anchor="middle" font-size="19" font-weight="700" fill="${i.texto}" font-family="system-ui, sans-serif">${esc(i.letra)}</text></svg>`;
}
