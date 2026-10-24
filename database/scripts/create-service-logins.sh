#!/usr/bin/env bash
# FaceAttend EDU — one database login per microservice (data isolation per service).
#
# The migrations create a NOLOGIN role per schema (svc_identity, svc_attendance, ...)
# that can only touch its own schema. This script creates (or updates the password
# of) the login each service uses, e.g. identity_app, and makes it a member of its
# role. Passwords come only from the environment; it is safe to run repeatedly.
#
# Required: IDENTITY_DB_PASSWORD AUTHORIZATION_DB_PASSWORD ACADEMIC_DB_PASSWORD
#           SCHEDULING_DB_PASSWORD ATTENDANCE_DB_PASSWORD CONFIGURATION_DB_PASSWORD
#           QUALITY_DB_PASSWORD NOTIFICATION_DB_PASSWORD
# Connection: PSQL (psql command). Defaults to the local container; for Neon:
#   PSQL="psql postgresql://<host>/<db>?sslmode=require" PGUSER=... PGPASSWORD=... ./database/scripts/create-service-logins.sh

set -euo pipefail

PSQL="${PSQL:-docker exec -i faceattend-postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-faceattend_db}}"

for schema in identity authorization academic scheduling attendance configuration quality notification; do
  var="$(echo "$schema" | tr '[:lower:]' '[:upper:]')_DB_PASSWORD"
  password="${!var:-}"
  if [[ -z "$password" ]]; then
    echo "$var is required" >&2
    exit 1
  fi
  if (( ${#password} < 16 )); then
    echo "$var must have at least 16 characters" >&2
    exit 1
  fi

  # format(%I, %L) quotes the name and the password, so nothing in them can change the SQL.
  $PSQL -v ON_ERROR_STOP=1 -q -v login="${schema}_app" -v role="svc_${schema}" -v schema="$schema" -v pw="$password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'login', :'pw')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'login') \gexec
SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'login', :'pw') \gexec
SELECT format('GRANT %I TO %I', :'role', :'login') \gexec
SELECT format('ALTER ROLE %I SET search_path = %I', :'login', :'schema') \gexec
SQL
  echo "login ${schema}_app ready (member of svc_${schema})"
done
