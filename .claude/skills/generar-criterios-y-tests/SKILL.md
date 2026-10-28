---
name: generar-criterios-y-tests
description: "Convierte la ficha en REQUISITOS.md y criterios de aceptacion etiquetados, consigue la aprobacion escrita del usuario y despues crea los tests que deben fallar antes de programar. Usala en la ronda 3 y al empezar la construccion."
---

# generar-criterios-y-tests

## A. Requisitos y criterios (fase r3)
1. Escribe `docs/REQUISITOS.md` con las cabeceras exactas de la plantilla: Problema, Alcance, Fuera de alcance (v2), Usuarios y roles, Datos y conexiones, Nivel de riesgo. Solo con lo que dice la ficha; no anadas funciones.
2. Escribe `docs/criterios.md`, una linea por criterio: `- C1 [FUNCIONAL] texto verificable`. Etiquetas: FUNCIONAL, BORDE, AUTORIZACION, SEGURIDAD, LIMITE, RENDIMIENTO. Cada criterio debe poder comprobarse con un test (nada de "debe ser facil").
   Cobertura minima: `trazabilidad.py` exige siempre FUNCIONAL y BORDE; SEGURIDAD si el nivel es 1 o mas; AUTORIZACION si hay perfiles distintos; LIMITE si modifica datos. Si falta alguna, `estado.py frase` lo dice: corrige.
3. Muestra el resumen al usuario en lenguaje llano y pide: "Revisalo. Si esta bien, escribe exactamente la frase que te voy a dar".
4. `python scripts/estado.py frase` y muestrale esa frase **tal cual**. **La tiene que escribir el usuario en su mensaje.** Nunca la escribas tu ni ejecutes `aprobar` por tu cuenta (R-12; el hook lo bloquea).
5. Con la frase en su ultimo mensaje: `python scripts/estado.py aprobar --nombre "<su nombre>" --frase "<frase>"`, luego `estado.py advance`.
6. Si el nivel es 3: se para; solo IT construye. Si es 2 o provisional: hace falta `aprobar-it` de IT antes de construir (lo dira el script).

## B. Tests primero (fase build)
1. Crea tests en `tests/` (unittest) con nombre y/o docstring que incluya el id del criterio (`test_C3_...`). Cada C# debe aparecer en algun test (TRZ4).
2. Solo datos ficticios (R-12).
3. `python scripts/ejecutar_tests.py --rojo` debe FALLAR (aun no hay codigo). Eso deja constancia. Despues **no se modifican ni borran tests** existentes (R-08): si un test es erroneo, se registra `cambio-alcance`. Se pueden anadir tests nuevos.
