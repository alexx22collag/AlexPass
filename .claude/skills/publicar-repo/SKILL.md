---
name: publicar-repo
description: "Sube la app a una rama de trabajo del repositorio (GitHub o Azure DevOps) y prepara la solicitud de revision para IT. Nunca sube a ramas protegidas. Usala en la fase publish."
---

# publicar-repo

Condiciones: `python scripts/estado.py check` sin fallos y `python scripts/validar.py` aprobado. `plataforma` en `config/politica.json` no puede ser "pendiente": si lo es, para y dile al usuario que IT debe indicar la plataforma.

1. Rama: `git checkout -b app/<nombre-corto>` (nunca main/master/prod/release; el hook lo bloquea).
2. `git add` solo de la carpeta de la app y docs. Antes revisa `git status`: nada de .env, claves ni ficheros ajenos.
3. Commit con mensaje claro. Sin `--no-verify`.
4. `git push -u origin app/<nombre>` (nunca force).
5. Abre la solicitud de cambios (PR) a la rama de integracion con una descripcion: que resuelve, nivel de riesgo, enlace a requisitos/criterios, resultados de verificacion, propietario y suplente. No la apruebas ni la completas tu (R-11): la aprueba IT (CODEOWNERS).
6. `python scripts/estado.py registrar-pr --url <url>` → la app pasa a done (congelada).
7. Dile al usuario: que ha pasado, que IT revisara y que cualquier cambio posterior se registra como `cambio-alcance`.
