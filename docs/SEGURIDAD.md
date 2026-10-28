# Revision de seguridad

> La rellena la skill revision-seguridad. Formato por punto:
>   - [x] S01 evidencia (fichero:linea o comando)
>   - [n/a] S12 motivo de al menos 10 caracteres (algunos puntos no admiten n/a: ver config/politica.json)

- [ ] S01 Sin credenciales en codigo, ficheros ni historial (scan_secretos.py en verde)
- [ ] S02 Toda configuracion sensible viene de variables de entorno que define IT
- [ ] S03 La identidad de la app tiene permisos minimos (solo lectura si el nivel es 1)
- [ ] S04 La autorizacion por usuario o rol se aplica en el origen de datos, no solo en pantalla
- [ ] S05 Las entradas del usuario se validan (tipo, longitud, caracteres) antes de usarse
- [ ] S06 Las consultas se parametrizan: nunca se concatena texto del usuario en una consulta
- [ ] S07 La salida web se escapa (sin inyeccion de HTML o scripts)
- [ ] S08 No se registran en logs ni errores datos personales ni secretos
- [ ] S09 Los mensajes de error no revelan rutas, consultas ni detalles internos
- [ ] S10 Dependencias de la lista aprobada y con version fija (check_dependencias.py en verde)
- [ ] S11 Sin llamadas a servicios externos que no esten declarados en la ficha
- [ ] S12 Autenticacion con la identidad corporativa de la plantilla, no usuarios o claves propios
- [ ] S13 Exportaciones y descargas limitadas a lo que el rol puede ver
- [ ] S14 Si modifica datos: prueba en seco, tope de registros, registro de auditoria y forma de revertir
- [ ] S15 Datos de prueba ficticios (scan_secretos.py --datos-reales en verde)
- [ ] S16 Sin datos sensibles guardados en el navegador (almacenamiento local, cookies sin proteger)
