#!/usr/bin/env bash
# FaceAttend EDU — espera a que el stack de docker compose esté sano (desde la raíz del repo):
# cada contenedor del proyecto con healthcheck en "healthy" y los de un solo uso (Liquibase, logins de BD)
# terminados con código 0. Falla en cuanto uno sale con error o se acaba el tiempo.
#
#   bash tools/e2e/ci/esperar-stack.sh [segundos]   (por defecto 900)
set -euo pipefail

LIMIT=${1:-900}
deadline=$((SECONDS + LIMIT))

while :; do
  pending=()
  while read -r name state exit_code health; do
    if [[ "$state" == "exited" ]]; then
      if [[ "$exit_code" != "0" ]]; then
        echo "::error::$name terminó con código $exit_code"
        docker logs --tail 80 "$name" 2>&1 || true
        exit 1
      fi
    elif [[ "$health" != "healthy" && "$health" != "none" ]]; then
      pending+=("$name($state/$health)")
    elif [[ "$state" != "running" ]]; then
      pending+=("$name($state)")
    fi
  done < <(docker compose ps -a -q |
    xargs docker inspect --format '{{.Name}} {{.State.Status}} {{.State.ExitCode}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' |
    sed 's#^/##')

  if [[ ${#pending[@]} -eq 0 ]]; then
    echo "stack sano tras ${SECONDS}s"
    exit 0
  fi
  if (( SECONDS >= deadline )); then
    echo "::error::el stack no quedó sano en ${LIMIT}s: ${pending[*]}"
    exit 1
  fi
  echo "esperando: ${pending[*]}"
  sleep 10
done
