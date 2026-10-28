# Criterios de aceptacion

Una linea por criterio, con este formato exacto. Cada test debe nombrar el criterio que comprueba (por ejemplo test_C1_...).
Etiquetas: FUNCIONAL, BORDE, AUTORIZACION, SEGURIDAD, LIMITE, RENDIMIENTO.

- C1 [FUNCIONAL] Al guardar una entrada con sitio, usuario, contraseña y cada cuánto caduca, aparece en mi lista con su fecha de caducidad calculada.
- C2 [FUNCIONAL] Al abrir la app veo un aviso con las contraseñas caducadas y las que caducan dentro de la antelación programada (7 días por defecto), y no se envía ningún correo.
- C3 [FUNCIONAL] La contraseña generada tiene 20 caracteres por defecto, nunca menos de 12, e incluye solo los tipos de carácter elegidos.
- C4 [FUNCIONAL] Tras guardar una contraseña nueva, pulsar Deshacer dentro de los 20 segundos devuelve la anterior.
- C5 [FUNCIONAL] El Excel exportado contiene sitio, usuario, tipo y fecha de caducidad de cada entrada.
- C6 [FUNCIONAL] La clave de emergencia se genera una vez, exige confirmar que se ha guardado y, al generar otra, la anterior deja de valer.
- C7 [FUNCIONAL] El fichero de calendario .ics contiene la fecha de caducidad y el nombre del sitio de cada entrada.
- C8 [FUNCIONAL] La contraseña de una entrada solo se muestra al pulsar Ver, y una contraseña copiada se borra del portapapeles a los 30 segundos.
- C9 [FUNCIONAL] Buscar por sitio o usuario y filtrar por estado de caducidad devuelve solo las entradas que cumplen la condición.
- C10 [FUNCIONAL] Renovar varias a la vez muestra primero una prueba en seco con el número de cambios y no modifica nada hasta que confirmo.
- C11 [FUNCIONAL] Cada alta, cambio, visualización de contraseña, exportación e inicio de sesión queda en el registro con fecha y acción, y solo su dueño lo ve.
- C12 [FUNCIONAL] Puedo editar y borrar una entrada de mi lista.
- C13 [FUNCIONAL] Buscando por el nombre del sitio encuentro y copio una contraseña en menos de 5 minutos desde que abro la app (criterio de éxito; se comprueba en la prueba guiada).
- C14 [BORDE] Con la lista vacía se muestra "Aún no tienes contraseñas guardadas" y un botón para añadir la primera.
- C15 [BORDE] Si la fecha de caducidad es imposible (pasada o de 0 días), la entrada se guarda y queda marcada como "Revisar".
- C16 [BORDE] Al renovar, la contraseña anterior se conserva hasta que confirmo que la nueva funciona o, si no la confirmo, durante 5 días.
- C17 [BORDE] La app avisa si la misma contraseña está en dos sitios y si hay un usuario repetido en el mismo sitio.
- C18 [BORDE] Sin la contraseña maestra ni la clave de emergencia no hay forma de abrir la caja y no existe recuperación por terceros; con la clave de emergencia se recupera el acceso.
- C19 [BORDE] Tras la baja del usuario, la caja se conserva 30 días y luego se borra.
- C20 [SEGURIDAD] Sin iniciar sesión con el SSO y sin abrir la caja con la contraseña maestra no se muestra ningún dato.
- C21 [SEGURIDAD] Las contraseñas se guardan cifradas y la contraseña maestra nunca se guarda en ningún sitio.
- C22 [SEGURIDAD] Las contraseñas en claro no quedan en el navegador (caché, historial ni autocompletado).
- C23 [SEGURIDAD] Ninguna exportación (Excel o calendario) contiene contraseñas, y la clave de emergencia nunca se envía por correo.
- C24 [LIMITE] Renovar varias a la vez admite como máximo 15 cambios; con más de 15 se rechaza sin modificar nada.
- C25 [LIMITE] El margen para deshacer es de 20 segundos: pasado ese tiempo, Deshacer ya no está disponible.
- C26 [LIMITE] El registro de acciones se conserva 12 meses.
