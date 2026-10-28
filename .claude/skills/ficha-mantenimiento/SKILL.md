---
name: ficha-mantenimiento
description: "Completa la ficha de mantenimiento de la app (propietario, suplente, revision, retirada, aviso de fallos) al final de la verificacion y antes de publicar. Usala en verify."
---

# ficha-mantenimiento

1. Con la ficha (propietario, suplente, duracion, aviso de fallos), completa `docs/MANTENIMIENTO.md` con claves en lineas `clave: valor`: `propietario`, `suplente`, `revision` (fecha AAAA-MM-DD, maximo 12 meses desde hoy; si no lo dice el usuario, propon 6 meses y preguntaselo), `retirada` (cuando se apaga: p. ej. "si nadie la usa en 3 meses" o la fecha limite si es temporal), `aviso_fallos`.
2. Explica al usuario que la app es suya (o de su equipo): IT la revisara en esa fecha y puede retirarla si no hay propietario.
3. `estado.py check` valida V3. No se publica sin esto.
