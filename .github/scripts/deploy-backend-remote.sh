#!/usr/bin/env bash
# Ejecutado en EC2 por .github/workflows/deploy-backend.yml vía `ssh ... bash -s`.
# Requiere DEPLOY_DIR (clon del repo en el host) y DEPLOY_SHA (commit a desplegar).
# Rollback manual por ahora: volver a ejecutar este script con el SHA anterior.
set -euo pipefail

: "${DEPLOY_DIR:?DEPLOY_DIR es obligatorio}"
: "${DEPLOY_SHA:?DEPLOY_SHA es obligatorio}"

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
HEALTH_TIMEOUT_SECONDS=600

cd "$DEPLOY_DIR"

if [ ! -f .env.prod ]; then
  echo "ERROR: falta $DEPLOY_DIR/.env.prod (ni en el host ni en el secret ENV_PROD_FILE)" >&2
  exit 1
fi

echo "==> Actualizando código a $DEPLOY_SHA"
git fetch --prune origin
git checkout --detach "$DEPLOY_SHA"

echo "==> Build y arranque de servicios"
"${COMPOSE[@]}" up -d --build --remove-orphans

echo "==> Esperando salud de servicios (máx. ${HEALTH_TIMEOUT_SECONDS}s)"
deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
while true; do
  # Excluye los contenedores Liquibase (one-shot, terminan con exit 0 por diseño).
  problems=$("${COMPOSE[@]}" ps -a --format '{{.Service}} {{.State}} {{.Health}}' \
    | grep -v -- '-liquibase ' \
    | awk '$2 != "running" || ($3 != "" && $3 != "healthy") {print}' || true)

  if [ -z "$problems" ]; then
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "ERROR: servicios no sanos tras el timeout:" >&2
    echo "$problems" >&2
    "${COMPOSE[@]}" ps -a >&2 || true
    exit 1
  fi
  sleep 15
done

echo "==> Verificando Kong (gateway)"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:8000/ || true)
if [ -z "$code" ] || [ "$code" = "000" ]; then
  echo "ERROR: Kong no responde en localhost:8000" >&2
  exit 1
fi
echo "Kong responde HTTP $code"
echo "==> Despliegue de backend $DEPLOY_SHA completado"
