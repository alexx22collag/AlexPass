// Prueba temporal: ¿puede este dispositivo dar un secreto con Face ID (WebAuthn PRF)?
// No guarda nada ni envia nada. Solo muestra una huella corta del secreto para comparar dos lecturas.
const $ = (s) => document.querySelector(s);
const salto = () => crypto.getRandomValues(new Uint8Array(32));
const SAL_PRF = new TextEncoder().encode('alexpass-prueba-prf-v1');
const RP = { name: 'AlexPass prueba' }; // rpId por defecto = el dominio de esta pagina
let ultima = null;

function log(t) { $('#log').textContent += t + '\n'; }
function limpiar() { $('#log').textContent = ''; }
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
async function huella(buf) { return hex((await crypto.subtle.digest('SHA-256', buf)).slice(0, 4)); }
function fallo(e) { log('✖ ' + (e && e.name ? e.name : 'Error') + ': ' + (e && e.message ? e.message : e)); }

async function paso1() {
  limpiar();
  log('Navegador: ' + navigator.userAgent);
  log('Modo pantalla de inicio: ' + (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches ? 'sí' : 'no'));
  log('Contexto seguro (https): ' + (globalThis.isSecureContext ? 'sí' : 'NO'));
  log('WebAuthn disponible: ' + (globalThis.PublicKeyCredential ? 'sí' : 'NO'));
  if (!globalThis.PublicKeyCredential) return;
  try { log('Autenticador de plataforma (Face ID/huella): ' + (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() ? 'sí' : 'NO')); } catch (e) { fallo(e); }
  if (PublicKeyCredential.getClientCapabilities) {
    try {
      const c = await PublicKeyCredential.getClientCapabilities();
      log('Capacidades del navegador: extension:prf = ' + String(c['extension:prf']) + ' · passkeyPlatformAuthenticator = ' + String(c.passkeyPlatformAuthenticator));
    } catch (e) { fallo(e); }
  } else {
    log('getClientCapabilities no existe: el soporte PRF solo se sabrá con el paso 2 y 3.');
  }
}

async function paso2() {
  limpiar();
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      rp: RP,
      user: { id: salto(), name: 'prueba', displayName: 'Prueba' },
      challenge: salto(),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
      extensions: { prf: { eval: { first: SAL_PRF } } },
    } });
    ultima = cred.rawId;
    const r = cred.getClientExtensionResults();
    log('✔ Passkey creada.');
    log('prf.enabled = ' + String(r.prf && r.prf.enabled));
    log('secreto devuelto ya al crear: ' + (r.prf && r.prf.results && r.prf.results.first ? 'sí' : 'no (normal)'));
    log('→ Ahora pulsa el paso 3.');
  } catch (e) { fallo(e); }
}

async function leer(n) {
  try {
    const opciones = { challenge: salto(), userVerification: 'required', extensions: { prf: { eval: { first: SAL_PRF } } } };
    if (ultima) opciones.allowCredentials = [{ type: 'public-key', id: ultima }];
    const a = await navigator.credentials.get({ publicKey: opciones });
    const r = a.getClientExtensionResults();
    const sec = r.prf && r.prf.results && r.prf.results.first;
    if (!sec) { log('✖ Lectura ' + n + ': el dispositivo NO ha devuelto secreto PRF.'); return; }
    log('✔ Lectura ' + n + ': secreto recibido (' + sec.byteLength + ' bytes). Huella: ' + await huella(sec));
  } catch (e) { fallo(e); }
}

$('#p1').addEventListener('click', paso1);
$('#p2').addEventListener('click', paso2);
$('#p3').addEventListener('click', () => { limpiar(); leer(1); });
$('#p4').addEventListener('click', () => leer(2));
