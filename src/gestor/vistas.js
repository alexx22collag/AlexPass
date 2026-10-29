// Piezas de HTML sin DOM (se pueden probar en Node). Todo lo que viene del usuario se escapa.
export const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Campo de contraseña sin valor previo y sin autocompletado del navegador.
export function campoContrasenaHtml(nombre) {
  return `<input type="password" name="${esc(nombre)}" id="${esc(nombre)}" autocomplete="new-password" autocapitalize="off" spellcheck="false">`;
}

// Lista de entradas. Con la lista vacia: mensaje y boton para añadir la primera.
export function listaHtml(entradas) {
  if (!entradas.length) {
    return '<section class="vacio"><p>Aún no tienes contraseñas guardadas</p><button type="button" class="primario" data-accion="nueva">Añadir mi primera contraseña</button></section>';
  }
  return '<ul class="lista">' + entradas.map((e) =>
    `<li class="entrada estado-${esc(e.estado.replace(' ', '-').toLowerCase())}" data-id="${esc(e.id)}">`
    + `<button type="button" class="fila" data-accion="abrir" data-id="${esc(e.id)}">`
    + `<span class="sitio">${esc(e.sitio)}</span><span class="usuario">${esc(e.usuario)}</span>`
    + `<span class="caduca">${esc(e.caduca)}</span><span class="etiqueta">${esc(e.estado)}</span></button></li>`).join('') + '</ul>';
}
