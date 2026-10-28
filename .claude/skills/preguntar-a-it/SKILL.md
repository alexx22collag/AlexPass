---
name: preguntar-a-it
description: "Prepara una consulta para IT cuando el usuario no sabe de donde viven los datos, que permisos tiene o como se conecta. Genera docs/consulta-IT.md y deja la app pendiente hasta que IT responda."
---

# preguntar-a-it

Se usa cuando alguna respuesta de datos/conexiones es "no lo se" (D02-D09, D11, S03), cuando hace falta una identidad o permiso nuevo, o cuando el nivel es 3.

1. Explica al usuario: "Esto lo tiene que decidir IT. Te preparo la consulta y mientras tanto avanzamos con la maqueta con datos ficticios."
2. Copia `docs/consulta-IT.plantilla.md` a `docs/consulta-IT.md` y rellenala SOLO con lo que el usuario ha dicho (app, objetivo, que datos cree que necesita, que sabe y que no). Preguntas tipicas para IT:
   - ¿En que sistema y entorno viven estos datos? ¿Quien es el responsable?
   - ¿Que identidad (no personal) debe usar la app? ¿Con que permisos minimos?
   - ¿Hay un entorno de pruebas con datos no reales?
   - ¿Que clasificacion tienen (personales/economicos)? ¿Se pueden exportar?
   - ¿Existe ya una app o integracion que cubra esto?
3. Nunca incluyas credenciales ni datos reales en la consulta (R-03, R-12).
4. `python scripts/ficha.py set estado_it_datos pendiente_it`.
5. Dile al usuario que envie `docs/consulta-IT.md` a IT (canal acordado) y que vuelva cuando IT conteste. Cuando conteste, anota las respuestas en la ficha (`ficha.py set ...`) y en la consulta, y `ficha.py set estado_it_datos resuelto` (el script lo rechaza si aun hay "no_se").
6. Mientras este pendiente, no se construye con datos reales (puerta G3.2). La maqueta y los requisitos si pueden avanzar.
