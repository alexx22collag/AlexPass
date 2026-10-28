---
# Rellena SOLO con: python scripts/ficha.py set CLAVE "VALOR"
problema: Se me olvidan siempre las contraseñas. Quiero un gestor de contraseñas propio que me avise de cuándo caducan y me dé contraseñas aleatorias para cuando tenga que renovarlas. Tiene que ser para usuarios únicos: que nadie pueda ver las mías, por si algún día comparto la app.
como_lo_hace_hoy: Las memorizo.
existe_algo_similar: no
usuarios_roles: Yo (el propietario) de momento; si funciona bien, se ampliaría al departamento.
frecuencia: Depende del sitio: en el ordenador la renuevo cada 6 meses, en Gmail cada 3 meses (por gusto). Cada vez que se me olvida tardo unos 30 minutos entre intentos fallidos y restablecerla.
criterio_exito: Encuentro mi contraseña en menos de 5 minutos, y la app me avisa una semana antes de que se bloquee la cuenta o cuando yo lo haya programado.
num_usuarios: 1
roles_distintos: no
responsable_datos: Cada persona, de sus propios datos (por persona).
objeto_datos: Credenciales (usuario o correo, contraseña y sitio) de cuentas personales del propio usuario. No se guardan credenciales de la empresa. Las escribe el propio usuario.
origen_datos: ninguno
entorno_datos: produccion
acceso_actual: usuario_personal
datos_personales: no
datos_economicos: no
conexion_externa: no
lee_modifica: modifica
reversible: si
frescura: tiempo_real
usuarios_externos: no
volumen_modificacion: 15
exporta_datos: si
formato: web_adaptable
estado_it_datos: resuelto
funciones_principales: 1) Guardar (sitio, usuario, contraseña, caducidad). 2) Avisar dentro de la app, sin correo. 3) Generar contraseñas aleatorias. 4) Deshacer (20 s tras guardar). 5) Exportar a Excel sin contraseñas. 6) Clave de emergencia impresa. 7) Calendario .ics sin contraseñas. 8) Ver y copiar (el portapapeles se borra a los 30 s). 9) Buscar y filtrar. 10) Renovar varias a la vez (máx. 15, con prueba en seco). 11) Registro de acciones (12 meses). 12) Editar y borrar.
avisos: Aviso dentro de la app, con la antelación que programe el usuario (por defecto una semana antes). Sin correo electrónico.
nunca_debe: Nunca mostrar los datos si no se ha iniciado sesión con el SSO y abierto la caja con la contraseña maestra. Nunca exportar contraseñas (ni en Excel ni en el calendario) ni enviarlas por correo.
entradas_salidas: Guardar: introduce sitio, usuario, contraseña y caducidad; obtiene una entrada. Avisar: se programa al guardar; obtiene un aviso en la app. Generar: longitud (20; mínima 12) y tipos de carácter; obtiene contraseña aleatoria. Deshacer: botón durante 20 s; vuelve la anterior. Exportar: Excel sin contraseñas. Clave de emergencia: se genera una vez, se confirma que se guardó y se puede generar otra (la anterior deja de valer). Calendario: fichero .ics con fecha y sitio, sin contraseñas.
reglas_negocio: No hay reglas del negocio que respetar.
casos_borde: Olvidar la contraseña maestra: solo sirve la clave de emergencia impresa; si se pierden ambas, se pierde todo (sin recuperación por terceros). Sitio rechaza la nueva: se conserva la anterior hasta confirmar o, si no se confirma, 5 días. Fecha imposible (pasada o de 0 días): se guarda y se marca Revisar. Avisar también de: misma contraseña en dos sitios y usuario repetido en el mismo sitio. Baja del usuario: la caja se conserva 30 días y luego se borra.
lugar_uso: Desde cualquier sitio (oficina, casa, móvil), sin restricciones de ubicación.
auditoria_necesaria: si
no_guardar_datos: La contraseña maestra nunca se guarda ni queda en el navegador. Las contraseñas en claro tampoco quedan en el navegador (ni en la caché, ni en el historial, ni en el autocompletado).
v2: Imagen corporativa de SANZ Clima (logos, colores y tipografía oficiales) en la maqueta y en la app. Ampliar la app al departamento (hasta 100 personas). Aviso por correo electrónico (la maqueta lo muestra, pero queda fuera de la versión 1). Copia o acceso sin conexión a las contraseñas.
propietario: Alexander Collaguazo Diaz
duracion: permanente
aviso_fallos: A nadie.
suplente: Brayan Collaguazo Diaz
---

# Ficha de la app

Respuestas de la entrevista. Las mantiene la skill `entrevista`; no se editan a mano.
