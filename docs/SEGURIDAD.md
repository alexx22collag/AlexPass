# Revision de seguridad

> La rellena la skill revision-seguridad. Formato por punto:
>   - [x] S01 evidencia (fichero:linea o comando)
>   - [n/a] S12 motivo de al menos 10 caracteres (algunos puntos no admiten n/a: ver config/politica.json)
>
> Revision de ayuda (no sustituye a la de IT). Apoyada en una segunda revision independiente hecha por un
> subagente que no escribio el codigo (29/10/2026). Los hallazgos corregidos tienen test en tests/js/correcciones.test.mjs;
> los demas estan en el apartado «Hallazgos abiertos» al final.

- [x] S01 Sin credenciales en codigo, ficheros ni historial: `python scripts/scan_secretos.py` -> SEC1 OK; tests con valores ficticios (`xxx-ficticio`, `@example.com`). src/config.js solo tiene el CLIENT_ID de OAuth, que es publico por diseno (no hay client secret).
- [x] S02 Configuracion sensible fuera del codigo: no existe configuracion sensible. src/config.js:1 contiene solo el CLIENT_ID publico; no hay claves, secretos ni cadenas de conexion. (No usa variables de entorno porque no hay servidor: IT debe valorar si lo acepta.)
- [x] S03 Permisos minimos: src/gestor/drive.js:3 pide un unico permiso, `drive.appdata` (carpeta oculta de la app, sin acceso al resto del Drive). Test C29 (tests/js/google_drive.test.mjs).
- [x] S04 Autorizacion en el origen: un solo usuario; el aislamiento por cuenta lo aplica Google (la carpeta appDataFolder es propia de cada cuenta y app; src/gestor/drive.js:23-24 usa `spaces=appDataFolder`) y los datos van cifrados con la clave del usuario. No hay perfiles distintos. Tests C20, C28, C29.
- [x] S05 Entradas validadas: src/gestor/caja.js:41 (maestra >= 12), :212 (caducidad entera), generar (longitud 12-128 y tipos), :56 (iteraciones 1000-5.000.000 al abrir). Tests C14, C15, C24, C38. Limite conocido: no hay tope de longitud en sitio/usuario/contrasena (v2).
- [x] S06 Consultas parametrizadas: la unica consulta (src/gestor/drive.js:23) usa un literal constante; no entra texto del usuario. No hay SQL.
- [x] S07 Salida escapada: src/gestor/vistas.js:2 `esc()` en todo lo que viene del usuario; src/app.js usa esc() o textContent; sin eval ni document.write. CSP sin unsafe-inline (src/index.html:6). Test de escape en tests/js/funcional.test.mjs.
- [x] S08 Sin datos en logs: no hay ningun `console.*` en src/ (revision independiente y grep). El registro de acciones solo guarda accion, fecha e id, nunca contrasenas (tests C11).
- [x] S09 Errores sin detalles internos: src/app.js:36 `mensajeError` devuelve un texto generico salvo los errores propios del dominio. Tests C18, C30.
- [x] S10 Sin dependencias de terceros: `python scripts/check_dependencias.py` -> DEP1 OK. No hay package-lock ni librerias; unica dependencia externa en ejecucion: el script de Google Identity Services (declarado).
- [x] S11 Servicios externos declarados: solo Google (accounts.google.com y www.googleapis.com), que estan en la ficha (conexion_externa = si) y limitados por la CSP de src/index.html:6.
- [n/a] S12 La v1 inicia sesion con Google y no con la identidad corporativa: Entra ID no se pudo registrar; decision aprobada por el propietario y por IT en docs/REQUISITOS.md. IT debe confirmarlo en su revision.
- [x] S13 Exportaciones limitadas: Excel e .ics no llevan contrasenas ni la clave de emergencia (test C23, tests/js/borde_seguridad_limite.test.mjs).
- [x] S14 Modificacion con control: prueba en seco y confirmacion (renovarVarias), tope de 15 (src/gestor/caja.js:367, test C24), registro de acciones (C11, C26), Deshacer 20 s (C4, C25) y contrasena anterior 5 dias con boton «Ver la anterior» (C16).
- [x] S15 Datos de prueba ficticios: `python scripts/scan_secretos.py --datos-reales` -> SEC2 OK.
- [x] S16 Sin datos sensibles en el navegador: no hay localStorage, sessionStorage, IndexedDB ni cookies en src/ (revision independiente y grep). Test C22. Se comprueba tambien a mano en la prueba guiada (P13).

## Hallazgos de la revision independiente
Corregidos (con test): renovar dos veces destruia la contrasena original (C16); ids repetidos en renovar varias (C24); una clave de emergencia nueva podia quedar anulada por otro dispositivo (C18); un PATCH 404 se daba por guardado (C30); caja con iteraciones absurdas bloqueaba el navegador (C38); la contrasena anterior no se podia ver (C16).

## Hallazgos abiertos (no corregidos en la v1; pasan a la v2 o son limites aceptados)
- Sin bloqueo por inactividad, sin reautenticacion para clave de emergencia, Face ID o baja, y el token de Google no se revoca al cerrar la caja.
- Dar de baja no se puede cancelar y la caja se borra al abrir la app pasados 30 dias, sin pedir la maestra; las exportaciones excluyen contrasenas, asi que no hay forma de sacar los datos.
- Dos ficheros caja.json si dos dispositivos nuevos crean la caja a la vez; guardado sin precondicion (ETag): si dos dispositivos guardan a la vez, el ultimo gana.
- La fusion depende del reloj de cada dispositivo (un reloj adelantado gana siempre); las lapidas se purgan a los 90 dias.
- Metadatos del contenedor (bio, bajaEl, datos antiguos) sin autenticar: quien tenga escritura en el Drive puede hacer rollback o borrar registros de Face ID, pero no descifrar.
- La maestra no se normaliza (Unicode) y solo exige 12 caracteres; no hay cambio de maestra ni rotacion de la clave de datos: quitar un Face ID no es una revocacion criptografica.
- El borrado del portapapeles puede no ejecutarse si la pestana no tiene foco; los mensajes de fallo al guardar no distinguen caja ajena de falta de conexion.
- Origen compartido en GitHub Pages: la passkey (WebAuthn) y el CLIENT_ID se asocian al origen alexx22collag.github.io, no al repositorio; cualquier otra pagina de la misma cuenta compartiria origen. Mitigacion: no publicar otros sitios en esa cuenta o usar dominio propio.
- GitHub Pages no permite cabeceras: sin `frame-ancestors` (clickjacking) ni Trusted Types.
- Face ID: cada «Activar» crea una passkey nueva; las huerfanas o antiguas hay que borrarlas a mano del dispositivo.
