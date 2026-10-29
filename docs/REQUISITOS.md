# Requisitos de la app

> Redactado a partir de docs/ficha.md y docs/huecos.md. El usuario lo aprueba con una frase exacta (python scripts/estado.py frase). Tras aprobarlo, no se toca: un cambio es un cambio de alcance.

## Problema
El propietario se olvida siempre de las contraseñas: entre intentos fallidos y restablecerlas tarda unos 30 minutos cada vez. Hoy las memoriza. Quiere un gestor de contraseñas propio que le avise de cuándo caducan, le dé contraseñas aleatorias para renovarlas y que nadie más pueda ver las suyas.
Criterio de éxito (palabras del usuario): encontrar su contraseña en menos de 5 minutos, y que la app le avise una semana antes de que caduque o cuando lo haya programado.

## Alcance
La versión 1 hace estas 13 cosas (de la ficha, de más a menos importante):
1. **Guardar** una contraseña: se introducen sitio, usuario, contraseña y cada cuánto caduca; se obtiene una entrada en la lista.
2. **Avisar** dentro de la app antes de que caduquen, con la antelación que se programe (por defecto una semana). Sin correo electrónico.
3. **Generar** contraseñas aleatorias: longitud por defecto 20, mínima 12, con los tipos de carácter elegidos.
4. **Deshacer** un cambio con un botón durante los 20 segundos siguientes a guardar; vuelve la contraseña anterior.
5. **Exportar a Excel** sitio, usuario, tipo y fecha de caducidad. Nunca contraseñas.
6. **Clave de emergencia** impresa: se genera una vez, se confirma que se ha guardado, se puede generar otra (la anterior deja de valer). Si se pierden la contraseña maestra y la clave, se pierde todo. Nunca se envía por correo.
7. **Calendario (.ics)** con la fecha de caducidad y el nombre del sitio de cada entrada, sin contraseñas.
8. **Ver y copiar** una contraseña. El portapapeles se borra a los 30 segundos.
9. **Buscar y filtrar** la lista.
10. **Renovar varias a la vez** (máximo 15), con prueba en seco antes de confirmar.
11. **Registro de acciones** (quién, cuándo y qué acción; nunca contraseñas), 12 meses, visible solo para su dueño.
12. **Editar y borrar** una entrada.
13. **Sincronizar** entre dispositivos: un botón «Sincronizar» trae los cambios hechos en otro dispositivo (web o móvil) y sube los propios, sin perder nada de ninguno de los dos.

Reglas de funcionamiento acordadas:
- Para ver datos hace falta iniciar sesión con Google y abrir la caja con la contraseña maestra.
- Al renovar, la contraseña anterior se conserva hasta que se confirma que la nueva funciona o, si no se confirma, 5 días.
- Si la fecha de caducidad es imposible (pasada o de 0 días), la entrada se guarda y se marca como "Revisar".
- La app avisa si la misma contraseña está en dos sitios o si hay un usuario repetido en el mismo sitio.
- Si se olvida la contraseña maestra, solo sirve la clave de emergencia. No hay recuperación por terceros.
- Con la lista vacía se muestra un mensaje y un botón para añadir la primera.
- Si se da de baja al usuario, la caja se conserva 30 días y se borra la primera vez que se abre la app pasado ese plazo (no hay servidor que lo haga por su cuenta).
- Si no hay conexión o la sesión de Google ha caducado al guardar, se avisa y el cambio no se pierde mientras la pestaña siga abierta; se guarda al volver a iniciar sesión.
- Cada vez que se guarda, primero se trae lo que haya en Drive y se fusiona con lo local: las entradas nuevas de cualquiera de los dos se conservan; si la misma entrada se cambió en los dos, gana la modificación más reciente; lo borrado en un dispositivo se borra en el otro. Si la caja de Drive no se puede leer o descifrar, no se sobrescribe y se avisa.
- Límite conocido: sin servidor no hay bloqueo; si dos dispositivos guardan en el mismo segundo, el segundo puede pisar al primero. Se corrige con el siguiente «Sincronizar».
- Lo que no se guarda: la contraseña maestra nunca se guarda ni queda en el navegador; las contraseñas en claro tampoco quedan en el navegador (caché, historial, autocompletado, almacenamiento local).
- A Google Drive solo llega texto cifrado. El cifrado se hace en el navegador, antes de enviarlo.
- El registro de acciones vive dentro de la caja cifrada. No es una auditoría a prueba de manipulación: el propio dueño podría alterarlo.
- Nunca se exportan contraseñas (ni en Excel ni en el calendario) ni se envían por correo.

Diferencias entre la maqueta y este documento (la maqueta no se pudo actualizar: tope de 3 iteraciones). Manda este documento: la maqueta muestra un aviso por correo que NO entra, y no muestra el calendario .ics, ni editar y borrar.

## Fuera de alcance (v2)
- Imagen corporativa de SANZ Clima (logos, colores y tipografía oficiales) en la maqueta y en la app.
- Ampliar la app al departamento (hasta 100 personas).
- Aviso por correo electrónico.
- Copia o acceso sin conexión a las contraseñas.
- Inicio de sesión con el SSO de la empresa (la versión 1 usa Google) y verificación de la app por Google.
- Registro de auditoría a prueba de manipulación (requiere un servidor).
- Descartado: exportar contraseñas y cualquier recuperación de la caja por terceros.

## Usuarios y roles
- Un único usuario: el propietario, Alexander Collaguazo Diaz. Sin perfiles distintos y sin administrador.
- Suplente: Brayan Collaguazo Diaz. La app es permanente.
- Cada persona solo vería sus propios datos (relevante cuando se amplíe en la versión 2).
- Aviso de fallos: a nadie (decisión del usuario; no hay aviso automático). IT puede exigir otra cosa.

## Datos y conexiones
- Origen: ninguno (los escribe el propio usuario). Entorno: producción.
- Datos: credenciales (usuario o correo, contraseña y sitio) de cuentas personales del propio usuario. No se guardan credenciales de la empresa, tampoco la del ordenador.
- Datos de personas: el usuario indica "no" (solo guarda nombres de usuario de sus propias cuentas). IT recalcula y puede discrepar.
- Datos económicos: no. Conexión externa: sí (Google, para iniciar sesión y guardar la caja cifrada). Usuarios externos: no. Formato: web adaptable, desde cualquier sitio (ordenador y móvil).
- Responsable de los datos: cada persona, de los suyos.
- Alojamiento: GitHub Pages (página estática y pública, sin servidor y sin dominio propio). La app funciona entera en el navegador.
- Identidad de acceso: inicio de sesión con Google (Google Identity Services). Se pide un solo permiso: guardar archivos de la propia app en Drive (`drive.appdata`). El ID de cliente de Google es público; no hay ningún secreto en el código.
- Almacén: carpeta oculta de la app en el Google Drive del propio usuario. Contiene solo la caja cifrada; ni Google ni GitHub ven nada en claro. Con la misma cuenta de Google y la contraseña maestra se ve lo mismo en cualquier dispositivo.
- Esto es una app personal: no usa el SSO de la empresa ni recursos de la empresa. En la construcción y en las pruebas se usan solo datos ficticios.
- Pendiente de IT al aprobar los requisitos (no resuelto):
  - (c) acceso desde cualquier sitio y sin restricciones;
  - (d) modelo sin recuperación por terceros;
  - (e) si ya existe un gestor de contraseñas aprobado en la empresa;
  - (f) calendario .ics con nombres de sitio fuera de la caja cifrada;
  - (g) si una app personal puede alojarse fuera de la empresa (GitHub Pages personal) y usar Google para el acceso.

## Nivel de riesgo
Nivel 2 - Escribe datos o los saca de la empresa. Lo construye el usuario con IT.
- Motivo: modifica datos de la empresa; puede enviar datos fuera de la empresa o usar un servicio de terceros (Google).
- Controles: IT aprueba los requisitos antes de construir; prueba en seco, tope de registros y registro de auditoría; forma de revertir documentada; revisión de IT en la solicitud de revisión.
- Límite conocido (inferencia, no regla): el script calcula el nivel con las respuestas de la ficha y no tiene una regla específica para "guarda contraseñas". IT recalcula al revisar y puede subirlo.
