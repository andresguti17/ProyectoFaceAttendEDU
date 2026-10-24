#!/usr/bin/env bash
# FaceAttend EDU — checks that each service login can read its own schema and is
# denied on every other one. Exit code 0 = isolation holds.
#
# Uses the same <SCHEMA>_DB_PASSWORD variables as create-service-logins.sh and runs
# psql inside the local postgres container (override CONTAINER for another one).

set -uo pipefail

CONTAINER="${CONTAINER:-faceattend-postgres}"
DB="${POSTGRES_DB:-faceattend_db}"
OWNER="${POSTGRES_USER:-postgres}"
SCHEMAS=(identity authorization academic scheduling attendance configuration quality notification)
failures=0

# One table per schema, read as the owner (who sees everything).
declare -A TABLE
for schema in "${SCHEMAS[@]}"; do
  TABLE[$schema]=$(docker exec "$CONTAINER" psql -U "$OWNER" -d "$DB" -tAc \
    "SELECT quote_ident(table_schema)||'.'||quote_ident(table_name) FROM information_schema.tables
      WHERE table_schema = '$schema' AND table_type = 'BASE TABLE' ORDER BY table_name LIMIT 1")
done

for own in "${SCHEMAS[@]}"; do
  var="$(echo "$own" | tr '[:lower:]' '[:upper:]')_DB_PASSWORD"
  password="${!var:?$var is required}"
  for other in "${SCHEMAS[@]}"; do
    table="${TABLE[$other]}"
    [[ -z "$table" ]] && continue
    if docker exec -e PGPASSWORD="$password" "$CONTAINER" \
         psql -h 127.0.0.1 -U "${own}_app" -d "$DB" -tAc "SELECT 1 FROM ${table} LIMIT 1" >/dev/null 2>&1; then
      result=allowed
    else
      result=denied
    fi
    expected=denied
    [[ "$own" == "$other" ]] && expected=allowed
    if [[ "$result" != "$expected" ]]; then
      echo "FAIL ${own}_app on ${table}: ${result} (expected ${expected})"
      failures=$((failures + 1))
    fi
  done
  echo "checked ${own}_app"
done

if (( failures > 0 )); then
  echo "$failures isolation failure(s)"
  exit 1
fi
echo "OK: every service login reads only its own schema"
