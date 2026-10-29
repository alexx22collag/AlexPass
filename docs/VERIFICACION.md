# Verificacion

## Prueba guiada del usuario
> Lo genera la skill prueba-guiada a partir de docs/criterios.md. Cada punto se marca [x] solo cuando el usuario
> confirma que ve lo esperado.
> App: https://alexx22collag.github.io/AlexPass/src/index.html. Usa solo datos ficticios en las pruebas (sitio "Prueba 1", usuario "yo@example.com").
> No pulses «Dar de baja» con tu caja real.

- [ ] P1 (C20, C27) Abre la app en el ordenador, pulsa «Iniciar sesión con Google» y escribe la contraseña maestra. Deberias ver la lista de contraseñas; sin la maestra no se muestra ninguna.
- [ ] P2 (C1, C2, C15) Añade 3 entradas ficticias: una a 90 días, una a 3 días y una a 0 días. Deberias verlas en la lista: «Vigente», «Por caducar» (con aviso arriba) y «Revisar».
- [ ] P3 (C3, C8) Genera una contraseña aleatoria de 20 caracteres en una entrada, pulsa «Copiar» y pégala en otro sitio. A los 30 segundos el portapapeles debe estar vacío.
- [ ] P4 (C4, C25) Cambia la contraseña de una entrada. Deberias ver «Deshacer (20 s)» abajo; al pulsarlo vuelve la anterior.
- [ ] P5 (C9, C13) Busca por el nombre del sitio y filtra por estado. Deberias encontrar y copiar una contraseña en menos de 5 minutos desde que abres la app.
- [ ] P6 (C10, C16, C24) Renueva una entrada y comprueba el botón «La nueva funciona». En «Renovar varias» elige 2 y pulsa la prueba en seco: no debe cambiar nada hasta pulsar «Confirmar cambios».
- [ ] P7 (C5, C7, C23) Exporta a Excel y el calendario (.ics) y abre los dos ficheros. Deberias ver sitio, usuario, tipo y fecha, y ninguna contraseña.
- [ ] P8 (C27, C31) Abre la app en el móvil con la misma cuenta y la maestra, y pulsa «Sincronizar». Deberias ver las mismas entradas. Añade una en el móvil, pulsa «Sincronizar» en el ordenador y debe aparecer.
- [ ] P9 (C32, C33) Con la caja abierta en los dos dispositivos, añade una entrada distinta en cada uno y guarda en ambos, sin sincronizar entre medias; luego pulsa «Sincronizar» en los dos. Deberias ver las dos entradas en ambos y ninguna perdida.
- [ ] P10 (C35, C36, C37) En el móvil activa Face ID (botón «Face ID»), cierra la caja y entra con «Entrar con Face ID». La maestra debe seguir abriendo la caja. Al quitar el dispositivo, el botón de entrada con Face ID deja de funcionar.
- [ ] P11 (C6, C18) Genera la clave de emergencia, confirma que la has guardado, cierra la caja y ábrela con ella. Deberias poder entrar; si inventas una clave, no.
- [ ] P12 (C11, C26) Abre «Registro». Deberias ver quién, cuándo y qué acción, y ninguna contraseña.
- [ ] P13 (C21, C22) Con la caja abierta pulsa F12 → Application (o Almacenamiento) y mira Local Storage, Session Storage y Cookies de esta página. Deberias verlos vacíos, sin contraseñas ni la maestra.

## Resultado del pipeline
(lo pega la skill verificacion, literal)
