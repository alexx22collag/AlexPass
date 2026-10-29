# Cambios posteriores a la v1: carpetas, etiquetas e iconos

> Aviso para IT: estas funciones se añadieron **después** de agotarse las 3 rondas de cambio de alcance (R-15)
> y **sin** pasar por requisitos y criterios aprobados con frase ni por la aprobación de IT. Las pidió el propietario
> y las implementó Claude con tests nuevos (`tests/js/etiquetas_iconos.test.mjs`, ids V2-*). Los criterios de abajo
> son una propuesta para regularizarlo en la revisión de IT; no forman parte de `docs/criterios.md` aprobado.

## Qué hace
- **Carpetas:** una carpeta opcional por contraseña (máx. 40 caracteres), filtro por carpeta y renombrar una carpeta entera.
- **Etiquetas:** hasta 10 por contraseña (máx. 30 caracteres, sin duplicados), filtro por etiqueta, y la búsqueda las encuentra.
- **Iconos automáticos:** el icono se reconoce por el nombre del sitio, en el propio navegador y sin llamadas externas. Paquete de unas 170 marcas
  (`src/gestor/marcas.js`, Simple Icons 13.21.0, licencia CC0; los logos son marcas de sus dueños). Si no se reconoce, avatar con la inicial y un color estable.
- Carpetas y etiquetas van dentro de cada entrada, cifradas, y se fusionan entre dispositivos como el resto de campos.

## Criterios propuestos
- C39 [FUNCIONAL] Se puede asignar carpeta y etiquetas a una contraseña, filtrar por ellas y encontrarlas con el buscador.
- C40 [LIMITE] Carpeta de hasta 40 caracteres, etiqueta de hasta 30 y 10 etiquetas por contraseña; fuera de esos límites se rechaza sin guardar.
- C41 [SEGURIDAD] Carpetas y etiquetas solo salen de la app cifradas; los iconos se resuelven en el navegador sin ninguna llamada externa.
- C42 [FUNCIONAL] Cada contraseña muestra el icono de su marca si se reconoce por el nombre, o un avatar con la inicial si no.

## Límites conocidos
- No hay logos de Microsoft (Office, Outlook, Teams), Yahoo, Bing, Disney+, HBO Max, Skype ni Deezer: Simple Icons los ha retirado. Llevan avatar con inicial.
- Reconoce solo las marcas del paquete y por el nombre del sitio; un sitio con un nombre muy distinto de la marca no se reconoce.
- Las carpetas no existen vacías: existen mientras alguna contraseña las usa.
- La carpeta y las etiquetas no se exportan a Excel ni al calendario.
