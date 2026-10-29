#!/usr/bin/env bash
# Monitoreo mínimo del servidor (OPS-02): salud pública, contenedores, 5xx en Kong y disco.
#
#   tools/monitor/check.sh                 # una pasada; sale con 1 si algo falla
#
# Pensado para cron cada 5 minutos en el servidor:
#   */5 * * * * HEALTH_URL=https://<API_DOMAIN>/api/v1/health ALERT_WEBHOOK_URL=<url> /ruta/tools/monitor/check.sh
#
# Variables (todas opcionales):
#   HEALTH_URL          URL pública de salud (por defecto http://localhost:8000/api/v1/health)
#   CONTAINER_PREFIX    prefijo de los contenedores a vigilar (faceattend-)
#   IGNORE_CONTAINERS   expresión regular de contenedores que pueden estar detenidos (liquibase|db-service-logins|mailpit)
#   MAX_5XX             respuestas 5xx tolerables en Kong en la ventana (5)
#   WINDOW              ventana de los registros de Kong, formato de docker (5m)
#   DISK_PATH, DISK_MAX_PCT   disco a vigilar y porcentaje máximo de uso (/ y 85)
#   ALERT_WEBHOOK_URL   URL que recibe un POST con {"text": "..."} (webhook entrante de Slack o Mattermost)
#   STATE_FILE          dónde recordar el último estado (/tmp/faceattend-monitor.state)
#
# Avisa solo cuando el estado cambia (de bien a mal, o de mal a bien), para no repetir el mismo aviso cada 5 minutos.
# No imprime secretos ni cuerpos de respuesta.
set -u

HEALTH_URL="${HEALTH_URL:-http://localhost:8000/api/v1/health}"
CONTAINER_PREFIX="${CONTAINER_PREFIX:-faceattend-}"
IGNORE_CONTAINERS="${IGNORE_CONTAINERS:-liquibase|db-service-logins|mailpit}"
MAX_5XX="${MAX_5XX:-5}"
WINDOW="${WINDOW:-5m}"
DISK_PATH="${DISK_PATH:-/}"
DISK_MAX_PCT="${DISK_MAX_PCT:-85}"
STATE_FILE="${STATE_FILE:-/tmp/faceattend-monitor.state}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

problems=()

# 1. Salud pública (la ruta que ve un usuario: Caddy, Kong y los servicios)
code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$HEALTH_URL" || true)
[[ "$code" == "200" ]] || problems+=("salud: ${HEALTH_URL} respondió ${code:-sin respuesta}")

# 2. Contenedores caídos, reiniciándose o sin pasar su healthcheck
if command -v docker >/dev/null 2>&1; then
  while IFS='|' read -r name status; do
    [[ -n "$name" ]] || continue
    # Las migraciones (liquibase) y otros trabajos de una sola vez terminan por diseño.
    [[ "$name" =~ $IGNORE_CONTAINERS ]] && continue
    case "$status" in
      *"(healthy)"*|*"(health: starting)"*|"Exited (0)"*) ;;
      *"(unhealthy)"*|*Restarting*|*Exited*|*Created*|*Dead*) problems+=("contenedor ${name}: ${status}") ;;
    esac
  done < <(docker ps -a --filter "name=^${CONTAINER_PREFIX}" --format '{{.Names}}|{{.Status}}')

  # 3. Errores 5xx recientes en el gateway
  n5xx=$(docker logs --since "$WINDOW" "${CONTAINER_PREFIX}kong" 2>&1 | grep -cE 'HTTP/[0-9.]+" 5[0-9]{2} ' || true)
  [[ "${n5xx:-0}" -le "$MAX_5XX" ]] || problems+=("kong: ${n5xx} respuestas 5xx en ${WINDOW} (máximo ${MAX_5XX})")
else
  problems+=("docker no está disponible en este equipo")
fi

# 4. Disco
used=$(df -P "$DISK_PATH" | tail -1 | grep -oE '[0-9]+%' | tail -1 | tr -d '%')
[[ "${used:-0}" -le "$DISK_MAX_PCT" ]] || problems+=("disco ${DISK_PATH} al ${used}% (máximo ${DISK_MAX_PCT}%)")

if ((${#problems[@]} == 0)); then
  current="ok"
  summary="FaceAttend EDU: todo en orden"
else
  current="fail"
  summary="FaceAttend EDU: $(printf '%s; ' "${problems[@]}")"
fi

previous=$(cat "$STATE_FILE" 2>/dev/null || echo "ok")
echo "$current" > "$STATE_FILE"
echo "$(date -u +%FT%TZ) ${summary}"

if [[ "$current" != "$previous" && -n "$ALERT_WEBHOOK_URL" ]]; then
  prefix="ALERTA"
  [[ "$current" == "ok" ]] && prefix="RECUPERADO"
  text="${prefix}: ${summary}"
  text=${text//\"/\'}
  curl -s -o /dev/null -m 10 -X POST -H 'Content-Type: application/json' \
    -d "{\"text\": \"${text}\"}" "$ALERT_WEBHOOK_URL" || echo "no se pudo enviar el aviso"
fi

[[ "$current" == "ok" ]]
