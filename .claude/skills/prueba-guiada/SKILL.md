---
name: prueba-guiada
description: "Guia a la persona para probar la app ella misma con un guion de pasos concretos y registrar el resultado en VERIFICACION.md. Usala al empezar la fase verify."
---

# prueba-guiada

1. Escribe `docs/VERIFICACION.md` con una lista `- [ ] P1 <paso concreto y resultado esperado>` basada en los criterios (al menos uno funcional, uno de borde y uno de permisos/seguridad por cada perfil).
2. Arranca la app con ficticios (di el comando exacto y que debe ver).
3. Pide al usuario que haga un paso y te diga que ve. Marca `- [x]` solo lo que el usuario confirme; si falla, registra el fallo y vuelve a `construir-app` (los tests no se tocan).
4. Nunca marques un paso por tu cuenta. Todos deben estar `[x]` para que `advance` pase (V1).
