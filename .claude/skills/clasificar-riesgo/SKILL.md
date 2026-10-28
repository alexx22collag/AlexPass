---
name: clasificar-riesgo
description: "Calcula y comunica el nivel de riesgo (0-3) de la app a partir de la ficha. El nivel lo decide un script y no se negocia. Usala al terminar la ronda 1 y cada vez que cambien los datos o permisos."
---

# clasificar-riesgo

1. Ejecuta `python scripts/clasificar_riesgo.py --escribir` y copia la salida literal al usuario.
2. Explica en 2 frases que significa el nivel y los controles que exige (viene en la salida):
   - 0: sin datos de empresa. 1: solo lectura. 2: modifica o datos sensibles: controles obligatorios. 3: la construye IT.
3. Si el nivel es **provisional** (hay respuestas "no lo se"): dilo claramente, que se toma el caso mas prudente (minimo 2) y activa `preguntar-a-it`.
4. Si hay **bloqueos** (por ejemplo cuenta compartida, R-05): no se avanza; ofrece preguntar a IT.
5. Si el usuario discute el nivel: aplica el protocolo de firmeza (R-06). Rebajarlo solo lo puede confirmar IT (`confirmar-descenso`, que tu no ejecutas).

Nunca calcules ni cambies el nivel a mano.
