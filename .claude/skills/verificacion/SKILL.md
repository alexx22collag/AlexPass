---
name: verificacion
description: "Comprueba el estado final antes de entregar: tests, escaneos, criterios, seguridad y prueba guiada, ejecutando los scripts de verdad. Usala en verify, antes de ficha-mantenimiento y publicar."
---

# verificacion

Ejecuta, en este orden, y copia las salidas literales:
1. `python scripts/ejecutar_tests.py`
2. `python scripts/validar.py`
3. `python scripts/estado.py check`

Si cualquiera falla: no se avanza. Explica cada codigo (TST, TRZ, SEC, DEP, EST, V1-V3) en una frase y arregla. Los fallos de tests se arreglan en el codigo, nunca en el test.
No digas "todo correcto" sin haber ejecutado estos comandos en este turno. El pipeline repetira todo y puede discrepar: manda el pipeline.
