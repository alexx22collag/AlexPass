# Estado de la app (lo escribe estado.py, no se edita a mano)

- App: Prueba 1 Skills Gnerales
- Propietario: Alexander Collaguazo Diaz
- Fase: verify (Verificacion)
- Nivel de riesgo: 2
- Rondas de cambios de alcance: 3
- Aprobacion del usuario: Alexander Collaguazo Diaz el 2026-10-29T12:48:27
- Solicitud de revision: sin abrir

## Historial
- 2026-10-28T19:55:54: App creada desde la plantilla
- 2026-10-28T20:21:56: Puerta r1 superada. Nueva fase: r2
- 2026-10-28T20:42:36: revision-huecos: pasada 1
- 2026-10-28T20:53:49: revision-huecos: pasada 2
- 2026-10-28T20:53:52: Puerta r2 superada. Nueva fase: r3
- 2026-10-29T09:34:59: IT aprueba los requisitos (Alexander Collaguazo Diaz)
- 2026-10-29T09:35:58: Requisitos y criterios aprobados por Alexander Collaguazo Diaz
- 2026-10-29T09:35:59: Puerta r3 superada. Nueva fase: build
- 2026-10-29T09:48:18: Cambio de alcance (1 de 3): Despliegue en GitHub Pages (web y movil, sin dominio ni servidor): login con Google en vez de SSO de empresa, caja cifrada en el navegador y guardada en Google Drive (appDataFolder), sin Docker ni Python en servidor
- 2026-10-29T09:57:23: IT aprueba los requisitos (Alexander Collaguazo Diaz)
- 2026-10-29T09:58:27: Requisitos y criterios aprobados por Alexander Collaguazo Diaz
- 2026-10-29T09:58:27: Puerta r3 superada. Nueva fase: build
- 2026-10-29T10:04:43: Puerta build superada. Nueva fase: verify
- 2026-10-29T12:23:55: Cambio de alcance (2 de 3): Sincronizacion entre dispositivos: boton Sincronizar y fusion al guardar. Hallazgo: dos dispositivos abiertos se pisan (ultimo en guardar gana, se pierden contrasenas).
- 2026-10-29T12:26:06: Requisitos y criterios aprobados por Alexander Collaguazo Diaz
- 2026-10-29T12:27:02: IT aprueba los requisitos (Alexander Collaguazo Diaz)
- 2026-10-29T12:27:09: Puerta r3 superada. Nueva fase: build
- 2026-10-29T12:28:00: Puerta build superada. Nueva fase: verify
- 2026-10-29T12:46:33: Cambio de alcance (3 de 3): Entrada con Face ID/huella (WebAuthn PRF) como alternativa a la contrasena maestra. Probado por el usuario en iPhone (Safari y pantalla de inicio): secreto identico en dos lecturas.
- 2026-10-29T12:48:14: IT aprueba los requisitos (Alexander Collaguazo Diaz)
- 2026-10-29T12:48:27: Requisitos y criterios aprobados por Alexander Collaguazo Diaz
- 2026-10-29T12:48:49: Puerta r3 superada. Nueva fase: build
- 2026-10-29T12:50:24: Puerta build superada. Nueva fase: verify
- 2026-10-29T13:06:50: Cambio de alcance rechazado (tope de rondas): Etiquetas por entrada y avatar/icono local por sitio (inicial y color; logos de marcas conocidas sin conexion externa)
