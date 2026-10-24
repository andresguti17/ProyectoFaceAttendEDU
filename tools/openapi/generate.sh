#!/usr/bin/env bash
# FaceAttend EDU — regenerates docs/openapi/<service>.json from the running code.
#
# Java services (springdoc): a throwaway Postgres gets the same Liquibase
# migrations as compose, each jar boots against it (Kafka/Redis are not needed
# to start) and /v3/api-docs is saved with sorted keys and without "servers",
# so the file only changes when an endpoint or a DTO changes.
# Biometric (FastAPI): app.openapi(), see biometric.py next to this script.
# The Node services have no OpenAPI generator yet (docs/openapi/README.md).
#
# Needs: docker, JDK 21 + Maven, python3. CI runs it and fails on any diff:
#   tools/openapi/generate.sh && git diff --exit-code docs/openapi
# Usage: tools/openapi/generate.sh [service ...]   (default: the four Java services)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/docs/openapi"
NET=fae-openapi
PG=fae-openapi-pg
PG_PORT="${OPENAPI_PG_PORT:-55432}"
DB=faceattend_db
PW=openapi-local-only
LIQUIBASE_IMAGE="${FACEATTEND_LIQUIBASE_IMAGE:-liquibase/liquibase:4.29.0}"
SERVICES=("$@")
[[ ${#SERVICES[@]} -eq 0 ]] && SERVICES=(01-ms-identity 02-ms-authorization 04-ms-scheduling 05-ms-attendance)

# docker -v needs host paths as Docker sees them; on Git Bash (Windows) path rewriting is
# turned off for docker only, because java and mvn still need it.
host_path() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
docker() { MSYS_NO_PATHCONV=1 command docker "$@"; }

cleanup() {
  [[ -n "${APP_PID:-}" ]] && kill "$APP_PID" 2>/dev/null || true
  docker rm -f "$PG" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

mkdir -p "$OUT"
docker network create "$NET" >/dev/null
docker run -d --name "$PG" --network "$NET" -p "127.0.0.1:$PG_PORT:5432" \
  -e POSTGRES_DB="$DB" -e POSTGRES_PASSWORD="$PW" \
  -v "$(host_path "$ROOT/database/database-init"):/docker-entrypoint-initdb.d:ro" \
  postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$PG" pg_isready -U postgres -d "$DB" >/dev/null 2>&1 && break
  sleep 1
done
sleep 2  # init scripts run, then the server restarts once

# Same order as the compose chain: later schemas reference earlier ones.
for dir in "$ROOT"/database/0*-ms-*-db; do
  echo "migrating $(basename "$dir")"
  if ! docker run --rm --network "$NET" -v "$(host_path "$dir"):/liquibase/project:ro" "$LIQUIBASE_IMAGE" \
      --searchPath=/liquibase/project --url="jdbc:postgresql://$PG:5432/$DB" \
      --username=postgres --password="$PW" --changeLogFile=changelog/changelog-master.yaml \
      --contexts=seed update >/tmp/fae-openapi-liquibase.log 2>&1; then
    tail -40 /tmp/fae-openapi-liquibase.log >&2
    exit 1
  fi
done

mvn -B -q -f "$ROOT/back-end/shared/auth-java/pom.xml" install -DskipTests

# Identity refuses to start without its encryption keys; throwaway ones are enough to read the spec.
export PII_ENCRYPTION_KEY="${PII_ENCRYPTION_KEY:-$(head -c 32 /dev/urandom | base64)}"
export PII_HASH_KEY="${PII_HASH_KEY:-$(head -c 32 /dev/urandom | base64)}"
# Attendance builds its MinIO client at startup (no connection is made to serve the spec).
export FACEATTEND_STORAGE_ACCESS_KEY="${FACEATTEND_STORAGE_ACCESS_KEY:-openapi}"
export FACEATTEND_STORAGE_SECRET_KEY="${FACEATTEND_STORAGE_SECRET_KEY:-openapi-local-only}"

port=18080
for svc in "${SERVICES[@]}"; do
  port=$((port + 1))
  dir="$ROOT/back-end/$svc"
  echo "building $svc"
  mvn -B -q -f "$dir/pom.xml" package -DskipTests -Djacoco.skip=true
  jar=$(ls "$dir"/target/*.jar | grep -v plain | head -1)
  log="$dir/target/openapi-boot.log"
  java -jar "$jar" --server.port="$port" \
    --spring.datasource.url="jdbc:postgresql://127.0.0.1:$PG_PORT/$DB?stringtype=unspecified" \
    --spring.datasource.username=postgres --spring.datasource.password="$PW" \
    --spring.liquibase.enabled=false --spring.kafka.bootstrap-servers=127.0.0.1:1 \
    --springdoc.api-docs.enabled=true --springdoc.writer-with-order-by-keys=true \
    >"$log" 2>&1 &
  APP_PID=$!
  ok=false
  for _ in $(seq 1 120); do
    if curl -fsS "http://127.0.0.1:$port/v3/api-docs" -o "$dir/target/openapi.json" 2>/dev/null; then ok=true; break; fi
    kill -0 "$APP_PID" 2>/dev/null || break
    sleep 1
  done
  kill "$APP_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
  APP_PID=
  if [[ "$ok" != true ]]; then
    echo "$svc did not serve /v3/api-docs; last log lines:" >&2
    tail -40 "$log" >&2
    exit 1
  fi
  python3 - "$dir/target/openapi.json" "$OUT/$svc.json" <<'PY'
import json, sys
spec = json.load(open(sys.argv[1], encoding="utf-8"))
spec.pop("servers", None)
with open(sys.argv[2], "w", encoding="utf-8", newline="\n") as f:
    json.dump(spec, f, indent=2, sort_keys=True, ensure_ascii=False)
    f.write("\n")
PY
  echo "wrote docs/openapi/$svc.json"
done
