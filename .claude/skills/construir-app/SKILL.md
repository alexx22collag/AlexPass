---
name: construir-app
description: "Programa la app en src/ para que pasen los tests ya creados, con datos ficticios o a traves de un adaptador que IT conecta, sin credenciales. Usala en la fase build tras tener los tests en rojo."
---

# construir-app

Condiciones (las comprueba el hook y `estado.py check`): fase build, requisitos aprobados, tests en rojo registrados, nivel 0-2 y no pendiente de IT con datos reales (G3.2).

## Reglas
- Solo escribes en `src/` (y `.env.example`, `README` de la app). Nunca en tests ya aprobados, docs aprobados, scripts, config ni pipelines.
- Datos: por defecto, un **adaptador de datos** con implementacion ficticia. La conexion real la monta IT: el codigo lee **nombres de variables de entorno** (documentados en `.env.example`) y nunca valores.
- Sin credenciales en codigo, ejemplos o logs. Sin `.env`.
- Dependencias: solo las de `config/dependencias-permitidas.txt` con version fija. Para otras: pide a IT (R-10).
- Nivel 2 (obligatorio): modo simulacion (dry-run) por defecto, limite de registros por ejecucion, confirmacion explicita antes de modificar, y registro de auditoria (quien, cuando, que).
- Errores: mensajes al usuario sin detalles internos.
- Codigo simple y comentado para quien mantenga. No hagas nada que no este en los criterios: si la persona pide algo nuevo → `cambio-alcance`.

## Ciclo
1. Escribe codigo minimo → `python scripts/ejecutar_tests.py` → corrige hasta verde.
2. Verde de verdad = resultado generado por el script para el codigo actual (R-09). Nunca digas "pasan" sin haberlo ejecutado.
3. `python scripts/validar.py` (estructura, secretos, dependencias) y arregla lo que marque.
4. `python scripts/estado.py advance` y pasa a la fase verify (prueba-guiada, revision-seguridad, ficha-mantenimiento, verificacion).
