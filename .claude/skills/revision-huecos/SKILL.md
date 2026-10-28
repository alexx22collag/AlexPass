---
name: revision-huecos
description: "Revision sistematica de lo que falta o se contradice en los requisitos antes de aprobarlos. Usala al terminar la ronda 2, antes de la ronda 3."
---

# revision-huecos

Recorre la lista FIJA siguiente contra `docs/ficha.md` (`python scripts/ficha.py show`) y la maqueta. No anadas ni quites puntos.

1. ¿Cada funcion principal tiene entrada, salida y caso de error definidos?
2. ¿Hay algo en "nunca debe" que contradiga una funcion?
3. ¿Quedan palabras ambiguas ("rapido", "algunos", "normalmente") sin cifra?
4. ¿Los perfiles de usuario estan claros: que ve y hace cada uno?
5. ¿El origen, el entorno y el responsable de cada dato estan definidos (o pendientes de IT)?
6. ¿Si modifica datos: limite, vuelta atras y registro estan definidos?
7. ¿Que pasa sin datos, con datos erroneos y cuando no hay conexion?
8. ¿Hay datos personales o economicos sin explicar para que se usan?
9. ¿Lo que se ve en la maqueta coincide con las funciones?
10. ¿Lo que queda fuera de alcance esta anotado (v2)?
11. ¿Hay criterio de exito medible?
12. ¿Existe ya algo parecido en la empresa y esta justificado?

## Salida
Escribe `docs/huecos.md` con una linea por hueco: `- [ ] H1 <descripcion y pregunta concreta para el usuario>`. Si no hay huecos, escribe `# Huecos` con `- [x] H0 Sin huecos detectados`.
Luego `python scripts/estado.py registrar-huecos`. Hay maximo 2 pasadas: si tras la segunda quedan huecos, se pasa a IT, no se sigue dando vueltas.

Haz las preguntas al usuario, actualiza la ficha y marca `- [x]` solo los huecos resueltos. `estado.py advance` no avanza con huecos abiertos.
