// Face ID / huella con WebAuthn (passkey del dispositivo) y la extension PRF: el dispositivo devuelve un
// secreto propio solo tras verificar al usuario. Nada se guarda en el navegador; el secreto cifra una copia
// de la clave de datos (ver Caja.activarBiometria). Si el dispositivo no lo soporta, la maestra sigue valiendo.
const SAL_PRF = new TextEncoder().encode('alexpass-face-id-v1');
const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));
const aB64 = (buf) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const prf = (cred) => { const r = cred.getClientExtensionResults().prf; return r && r.results && r.results.first ? new Uint8Array(r.results.first) : null; };

export async function soportado() {
  try {
    return !!(globalThis.isSecureContext && globalThis.PublicKeyCredential
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

// Crea la passkey. Devuelve {id, secreto}; secreto es null si el dispositivo no lo da al crear:
// entonces hay que llamar a leer(id) en un segundo toque del usuario.
export async function registrar() {
  const cred = await navigator.credentials.create({ publicKey: {
    rp: { name: 'AlexPass' },
    user: { id: aleatorio(32), name: 'AlexPass', displayName: 'AlexPass' },
    challenge: aleatorio(32),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { residentKey: 'required', userVerification: 'required', authenticatorAttachment: 'platform' },
    extensions: { prf: { eval: { first: SAL_PRF } } },
  } });
  const r = cred.getClientExtensionResults().prf;
  if (!r || r.enabled !== true) throw new Error('Este dispositivo no permite usar Face ID para abrir la caja.');
  return { id: aB64(cred.rawId), secreto: prf(cred) };
}

// Pide Face ID y devuelve {id, secreto}. Sin id, el dispositivo ofrece sus passkeys de AlexPass.
export async function leer(id = null) {
  const publicKey = { challenge: aleatorio(32), userVerification: 'required', extensions: { prf: { eval: { first: SAL_PRF } } } };
  if (id) publicKey.allowCredentials = [{ type: 'public-key', id: Uint8Array.from(atob(id), (c) => c.charCodeAt(0)) }];
  const a = await navigator.credentials.get({ publicKey });
  const secreto = prf(a);
  if (!secreto) throw new Error('Este dispositivo no ha dado el secreto de Face ID.');
  return { id: aB64(a.rawId), secreto };
}
