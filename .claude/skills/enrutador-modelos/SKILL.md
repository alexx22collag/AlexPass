---
name: enrutador-modelos
description: Decide qué modelo (Haiku, Sonnet u Opus) debe ejecutar cada parte de una petición para ahorrar tiempo y tokens sin perder calidad, y delega en subagentes con el modelo adecuado. Úsala siempre que la petición tenga varias subtareas separables, búsquedas amplias en el código, tareas mecánicas repetitivas (renombrar, formatear, generar boilerplate, resumir logs, traducir), o cuando el usuario mencione ahorrar tokens, coste, velocidad, "usa el modelo barato/rápido", "usa haiku/sonnet/opus" o "/enrutador-modelos". No la uses para preguntas cortas de una sola respuesta: ahí contestar directamente es lo más barato.
---

# Enrutador de modelos

## Qué puede y qué no puede hacer esta skill

- **Puede**: lanzar subagentes (herramienta `Agent`) con `model: "haiku" | "sonnet" | "opus"`. Cada subagente trabaja en su propio contexto y solo devuelve su conclusión, así que además de usar un modelo más barato, evita llenar tu contexto con volcados de archivos.
- **No puede**: cambiar el modelo de la conversación principal. Ese lo fija el usuario con `/model`. Si la sesión principal está en Opus, cada token que tú (el orquestador) lees o escribes se cobra a precio de Opus. Por eso **delega el volumen** (lectura masiva, salida larga, trabajo mecánico) y quédate tú con lo poco y difícil.

## Coste oculto de delegar (léelo antes de decidir)

Un subagente arranca **sin contexto**: hay que explicarle la tarea y volverá a leer archivos que tú quizá ya leíste. Además tarda unos segundos en arrancar. Por tanto:

- **No delegues** si la tarea cabe en 1–3 llamadas a herramientas o si ya tienes en contexto todo lo necesario. Hazlo tú directamente: es más rápido y barato.
- **Delega** cuando el trabajo implique leer/escribir mucho (muchos archivos, logs largos, salidas extensas) o cuando haya partes independientes que puedan ir en paralelo.

## Tabla de decisión

| Nivel | Modelo | Úsalo para | Señales |
|---|---|---|---|
| 1 | `haiku` | Trabajo mecánico con resultado verificable | Buscar/listar archivos o usos de un símbolo; resumir logs o salidas largas; renombrados y cambios repetitivos con patrón claro; formatear, convertir JSON/CSV/YAML; boilerplate a partir de una plantilla; traducir textos; extraer datos de documentos; ejecutar tests y reportar qué falló |
| 2 | `sonnet` | Desarrollo normal | Implementar una funcionalidad con requisitos claros; corregir un bug cuya causa está localizada; escribir tests; refactor acotado a pocos archivos; revisar un diff pequeño; documentación técnica |
| 3 | `opus` | Razonamiento difícil o caro de equivocarse | Diseño de arquitectura y decisiones con compromisos; bugs sin causa conocida (concurrencia, condiciones de carrera, fallos intermitentes); seguridad y revisión de código crítico; cambios que tocan muchos módulos acoplados; migraciones de datos o acciones difíciles de revertir; requisitos ambiguos que hay que interpretar |

Reglas de desempate:
1. **Coste del error**: si un fallo es caro (producción, datos, seguridad, dinero), sube un nivel.
2. **Verificabilidad**: si el resultado se comprueba fácilmente (compila, test pasa, grep confirma), puedes bajar un nivel.
3. **Duda real entre dos niveles**: elige el superior para la parte de razonamiento y el inferior para la ejecución (ver patrón "planificar caro, ejecutar barato").

## Patrones

**Explorar barato, decidir caro.** Lanza `haiku` (o el agente `Explore`) para localizar archivos y resumir lo relevante; tú decides con ese resumen. Pide al subagente que devuelva rutas `archivo:línea` y un resumen breve, no el contenido completo.

**Planificar caro, ejecutar barato.** Para cambios grandes, diseña el plan tú (o con un subagente `opus` si la sesión no está en Opus), y entrega pasos concretos y autocontenidos a subagentes `sonnet`/`haiku`. Cuanto más preciso sea el encargo, más bajo puede ser el modelo.

**Paralelizar lo independiente.** Varias subtareas independientes → varios subagentes en el mismo mensaje.

**Escalar al fallar.** Si un subagente barato devuelve algo incorrecto o incompleto, no repitas con el mismo modelo: sube un nivel y dale el error obtenido como contexto.

**Verificar siempre lo delegado.** Revisa el resultado de un subagente antes de darlo por bueno (ejecuta el test, mira el diff). Un modelo barato sin verificación sale caro.

## Cómo redactar el encargo al subagente

Un buen encargo hace que el modelo barato acierte a la primera. Incluye:
- Objetivo en una frase y criterio de "terminado".
- Rutas exactas y contexto que ya conoces (para que no lo vuelva a buscar).
- Qué debe devolver y en qué formato (breve: rutas, diff resumido, lista de fallos).
- Restricciones: qué no tocar.

## Transparencia con el usuario

Al delegar, indica en una línea qué modelo usas y por qué (p. ej. "Búsqueda de usos → haiku; corrección del bug → sonnet"). Si detectas que toda la sesión sería más barata en otro modelo (p. ej. una larga tanda de cambios mecánicos con la sesión en Opus), sugiérelo: `/model sonnet` o `/model haiku`, y `/model opus` cuando vuelva el trabajo difícil.
