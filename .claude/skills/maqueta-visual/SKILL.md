---
name: maqueta-visual
description: "Genera una maqueta visual navegable con datos ficticios para que la persona vea como sera la app y la corrija antes de programarla. Usala en la ronda 1 y la ronda 2."
---

# maqueta-visual

Objetivo: que alguien sin conocimientos vea la app y diga "si, es esto" o "no, cambia esto".

## Reglas
- Un unico `maqueta/index.html` autocontenido (HTML+CSS+JS en un fichero), sin librerias externas ni llamadas a red.
- Debe llevar visible, arriba y siempre, el rotulo exacto **MAQUETA · DATOS FICTICIOS** (lo comprueba la puerta G1.5).
- Solo datos inventados evidentes (Cliente Ejemplo 1, importes redondos, correos @example.com). Nunca datos reales (R-12; lo escanea `scan_secretos.py`).
- Sin credenciales, sin conexiones reales, sin codigo de produccion. Solo escribe en `maqueta/`.
- Muestra las pantallas principales, los perfiles distintos (selector de rol si procede) y al menos un estado vacio y un estado de error.

## Procedimiento
1. Con lo contestado en la ronda 1, construye la maqueta y abrela / ensenasela (artefacto o fichero).
2. Pregunta: "¿Se parece a lo que tenias en la cabeza? ¿Que cambiarias?"
3. Cada iteracion: `python scripts/estado.py iteracion-maqueta` (maximo 3). Pasadas las 3, se sigue con lo que hay y los cambios se anotan para v2.
4. Dile siempre: "Esto es solo un dibujo: todavia no funciona ni toca datos reales."
