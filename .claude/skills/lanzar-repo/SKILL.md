---
name: lanzar-repo
description: Arranca y prueba un repositorio recién clonado en este PC Windows (Docker Desktop, Go, Node, .NET, Python). Usar cuando el usuario pida "lanza/arranca/levanta el proyecto", tras clonar o hacer fork de un repo, o para comprobar que una app funciona de verdad. Resuelve Docker Desktop apagado y conflictos de puertos con otros proyectos.
---

# Lanzar un repositorio clonado

Objetivo: dejar la app **corriendo y probada como la usaría una persona**, no solo "arrancada".

## Datos fijos de este entorno

- Windows 11; usar el tool **Bash** (Git Bash). Cada llamada resetea el cwd: hacer siempre `cd <repo> && ...`.
- Los repos se clonan en `C:\Users\bacollaguazo\Documents\GitHub\<repo>` (`/c/Users/bacollaguazo/Documents/GitHub/<repo>`).
- `gh` está autenticado como `alexx22collag`.
- Go está instalado. **Buffalo CLI no está instalado** (no usar `buffalo dev` salvo que se instale).
- Docker Desktop: `"/c/Users/bacollaguazo/AppData/Local/Programs/DockerDesktop/Docker Desktop.exe"`. Suele estar **apagado**.
- Hay varios proyectos hermanos (p. ej. `Entaina/desarrollo-agentico-todo-01..04`) que usan **los mismos puertos** (3000 app, 5432 Postgres) y tienen `restart: unless-stopped`: al arrancar Docker, sus contenedores vuelven solos y ocupan los puertos.

## Paso 1 — ¿El repo ya trae su propio procedimiento?

```bash
cd <repo> && grep -Hm1 '^description:' .claude/skills/*/SKILL.md 2>/dev/null; ls; cat README* 2>/dev/null | head -60
```
Si hay una skill del repo para arrancarlo, seguirla tal cual. Si no, seguir aquí.

## Paso 2 — Identificar el tipo de proyecto

| Señal | Cómo se arranca |
|---|---|
| `compose.yaml` / `docker-compose.yml` | `docker compose up -d --build` (opción preferida si existe) |
| `go.mod` + `cmd/<x>/main.go` | `go run ./cmd/<x>` (la BD con `docker compose up -d db` si hay compose) |
| `.buffalo.dev.yml` | App Buffalo (Go). Mirar `cmd/app/main.go`: si llama a `models.Migrate()`, migra sola al arrancar |
| `package.json` | `npm ci` y luego el script `dev` o `start` |
| `*.csproj` / `*.sln` | `dotnet run --project <proyecto>` |
| `pyproject.toml` / `requirements.txt` | venv + `pip install`, luego el entrypoint del README |

Leer siempre `Dockerfile`, `compose.yaml`, la config de BD (`database.yml`, `.env.example`…) y el entrypoint para saber **puertos, variables y migraciones**.

## Paso 3 — Docker Desktop (si hace falta)

```bash
docker info --format '{{.ServerVersion}}' >/dev/null 2>&1 || {
  "/c/Users/bacollaguazo/AppData/Local/Programs/DockerDesktop/Docker Desktop.exe" >/dev/null 2>&1 &
  for i in $(seq 1 45); do docker info >/dev/null 2>&1 && break; sleep 4; done; }
docker info --format '{{.ServerVersion}}'
```

## Paso 4 — Comprobar puertos ANTES de arrancar

```bash
docker ps --format '{{.Names}}\t{{.Ports}}\t{{.Status}}'
netstat -ano | grep -E ':(3000|5432|8080|5000) .*LISTEN'
tasklist //FI "PID eq <pid>" //FO CSV //NH
```
- `com.docker.backend.exe` y `wslrelay.exe` son de Docker: el puerto lo tiene **un contenedor**; ver cuál con `docker ps`.
- **Si el puerto lo tiene un contenedor de otro proyecto:** el repo con el que trabaja el usuario es el que manda, pero **no se paran contenedores ajenos sin confirmación explícita** (el clasificador de auto mode también lo bloquea). Mostrar al usuario el comando para que lo ejecute él con `!`:
  ```
  ! docker update --restart=no <contenedor> && docker stop <contenedor>
  ```
  (`--restart=no` evita que vuelva a coger el puerto la próxima vez que se arranque Docker. Se revierte con `docker update --restart=unless-stopped <contenedor>`.)
- Si el contenedor ajeno está **en bucle de reinicios** (`Exited (n) hace X segundos` con `restart=unless-stopped`, mirar `docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' <c>`), el puerto queda libre entre reintentos: un `docker compose up -d` del repo correcto en ese momento se queda el puerto, y el ajeno fallará al reintentar. No hace falta pararlo, pero avisar de que si el repo correcto se para, el ajeno puede recuperar el puerto.
- **Alternativa sin parar nada:** publicar en otro puerto con un override en el scratchpad (sin tocar el repo):
  ```yaml
  # <scratchpad>/compose.portXXXX.yaml
  services:
    app:
      ports: !override
        - "3003:3000"
  ```
  `docker compose -f compose.yaml -f <override> up -d`. Avisar de que es temporal y de que `docker compose up` a secas vuelve al puerto original.
- Postgres 5432: si lo tiene la BD de otro proyecto hermano, avisar. Las BDs de cada proyecto están en volúmenes distintos y no se mezclan, pero no pueden estar arrancadas a la vez.

## Paso 5 — Arrancar y esperar a que esté sano

```bash
cd <repo> && docker compose up -d --build 2>&1 | tail -15
for i in $(seq 1 30); do curl -fsS http://localhost:<puerto>/healthz && break; sleep 2; done
docker compose ps; docker compose logs app 2>&1 | tail -20
```
Si no existe `/healthz`, usar la ruta raíz o la que indique el `healthcheck` del compose.

## Paso 6 — Usarla de verdad (obligatorio)

1. Sacar las rutas (en Buffalo: `grep -nE 'GET|POST|PUT|DELETE' actions/app.go`).
2. `GET /` → 200, y que tenga contenido (título, elementos de la lista).
3. Hacer una acción de escritura por el camino real. En apps Buffalo/Rails con CSRF:
   ```bash
   J=/tmp/cj.txt; rm -f $J; curl -s -c $J http://localhost:<p>/ > /tmp/idx.html
   T=$(grep -o 'name="authenticity_token" value="[^"]*"' /tmp/idx.html | head -1 | sed 's/.*value="//;s/"$//')
   curl -s -b $J -c $J -o /dev/null -w "%{http_code} -> %{redirect_url}\n" \
     --data-urlencode "authenticity_token=$T" --data-urlencode "title=Prueba de arranque (Claude)" http://localhost:<p>/tasks
   curl -s -b $J http://localhost:<p>/ | grep -o "Prueba de arranque (Claude)"
   ```
4. **Borrar los datos de prueba** al terminar (p. ej. `docker exec <db> psql -U postgres -d <bd> -c "DELETE ..."`).

## Paso 7 — Informe al usuario

- URL final y puerto, y qué se ha probado con su resultado (código HTTP, contenido).
- Qué se ha tenido que hacer (arrancar Docker, override de puerto…) y qué es temporal.
- Conflictos pendientes (otros proyectos que ocupan puertos), con el comando exacto para resolverlos.
- Comandos útiles: `docker compose logs -f app`, `docker compose down` (conserva los datos), `docker compose down -v` (**borra la BD**), `docker compose up -d --build`.
