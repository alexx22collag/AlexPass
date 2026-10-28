---
name: elegir-formato
description: "Ayuda a decidir donde se usara la app (escritorio, web, movil) segun quien la usa y como. Hoy solo se construyen web y web adaptable. Usala en la ronda 1, bloque B."
---

# elegir-formato

Pregunta M01 del banco. Orienta con esta tabla, sin imponer:

| Situacion | Recomendacion |
|---|---|
| Se usa en oficina y en movil, varias personas | web_adaptable |
| Solo en oficina, pantallas grandes | web |
| Necesita camara, GPS u offline | movil: no soportado todavia → proponer web_adaptable y anotar el resto en v2 / consultar a IT |
| Programa de escritorio instalable | escritorio: no soportado todavia → proponer web y consultar a IT |

Los formatos soportados estan en `config/politica.json` (`formatos_soportados`); si el usuario elige otro, explicalo y guarda solo un formato soportado con `ficha.py set formato <valor>`. No prometas nada que no este soportado.
