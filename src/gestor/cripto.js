// Cifrado con WebCrypto (sin librerias): AES-256-GCM y claves derivadas con PBKDF2-SHA256.
// Todo ocurre en el navegador; a Drive solo llega texto cifrado.
const enc = new TextEncoder();
const dec = new TextDecoder();

export const ITERACIONES_POR_DEFECTO = 600000; // minimo recomendado por OWASP para PBKDF2-SHA256

export function b64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function deb64(texto) {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

export function aleatorio(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

// Entero aleatorio uniforme en [0, n) sin sesgo de modulo.
export function enteroAleatorio(n) {
  const limite = Math.floor(0x100000000 / n) * n;
  const x = new Uint32Array(1);
  do { crypto.getRandomValues(x); } while (x[0] >= limite);
  return x[0] % n;
}

// Clave AES derivada de una contraseña (la maestra o la clave de emergencia).
export async function derivar(secreto, sal, iteraciones) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secreto), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: iteraciones, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function claveDesdeBytes(bytes) {
  return crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// Devuelve iv(12) + cifrado + etiqueta, en base64.
export async function cifrar(clave, bytes) {
  const iv = aleatorio(12);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, bytes));
  const salida = new Uint8Array(iv.length + cifrado.length);
  salida.set(iv); salida.set(cifrado, iv.length);
  return b64(salida);
}

// Lanza Error si la clave es incorrecta o los datos se han alterado.
export async function descifrar(clave, texto) {
  try {
    const todo = deb64(texto);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: todo.slice(0, 12) }, clave, todo.slice(12)));
  } catch {
    throw new Error('clave incorrecta o datos alterados');
  }
}

export const aTexto = (bytes) => dec.decode(bytes);
export const deTexto = (texto) => enc.encode(texto);
