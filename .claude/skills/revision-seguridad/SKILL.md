---
name: revision-seguridad
description: "Revisa la app contra la lista de seguridad S01-S16 con evidencia, apoyada en una segunda revision independiente. Usala en la fase verify, despues de la prueba guiada."
---

# revision-seguridad

1. Abre `docs/SEGURIDAD.md`. Cada punto S01-S16 se marca `- [x] Sxx <evidencia: fichero y linea o test>` o `- [n/a] Sxx <motivo>`. Algunos puntos no admiten n/a (`seguridad_no_na` en `config/politica.json`): se cumplen siempre.
2. Debes poder senalar la evidencia en `src/` o `tests/`. Sin evidencia = no marcado.
3. Lanza un subagente de revision independiente que NO haya escrito el codigo (tipo general-purpose) con este encargo: "Revisa src/ y tests/ buscando credenciales, datos reales, consultas sin parametrizar, falta de control de permisos, exposicion de datos en errores, dependencias sospechosas y operaciones de modificacion sin limite. Informa de problemas, no los arregles." Corrige lo que encuentre.
4. `python scripts/validar.py` debe quedar sin hallazgos de secretos o dependencias.
5. Informa al usuario con las palabras exactas de los scripts. La lista no se acorta ni se adapta.

Esto es una revision de ayuda; la que cuenta es la de IT en la solicitud.
