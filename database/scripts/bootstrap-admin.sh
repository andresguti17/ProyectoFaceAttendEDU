#!/usr/bin/env bash
# FaceAttend EDU — creates (or restores) the first global administrator.
#
# Migrations no longer ship any account: this script is the only way to get the
# first Super Administrador, and it never runs on its own (not from compose, not
# from CI). Credentials come from the environment, never from the repository.
#
# Usage:
#   BOOTSTRAP_ADMIN_USERNAME=admin.sede BOOTSTRAP_ADMIN_EMAIL=admin@sede.edu.co \
#   BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>' ./database/scripts/bootstrap-admin.sh
#
#   --reset   the user already exists: set the new password, reactivate it and
#             make sure it holds the Super Administrador role (use after the
#             004 migration disabled the old admin.faceattend account).
#
# Connection: PSQL is the psql command to run. Defaults to the local container;
# for Neon pass a connection string, e.g.
#   PSQL="psql $DATABASE_URL" ./database/scripts/bootstrap-admin.sh
#
# The new account must change its password on first sign-in.

set -euo pipefail

RESET=false
[[ "${1:-}" == "--reset" ]] && RESET=true

: "${BOOTSTRAP_ADMIN_USERNAME:?BOOTSTRAP_ADMIN_USERNAME is required}"
: "${BOOTSTRAP_ADMIN_PASSWORD:?BOOTSTRAP_ADMIN_PASSWORD is required}"
if [[ "$RESET" == false ]]; then
  : "${BOOTSTRAP_ADMIN_EMAIL:?BOOTSTRAP_ADMIN_EMAIL is required}"
fi
if (( ${#BOOTSTRAP_ADMIN_PASSWORD} < 12 )); then
  echo "BOOTSTRAP_ADMIN_PASSWORD must have at least 12 characters" >&2
  exit 1
fi

PSQL="${PSQL:-docker exec -i faceattend-postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-faceattend_db}}"

# Values travel as psql variables and are interpolated with :'var', which
# quotes them as literals: nothing in them can change the SQL.
$PSQL -v ON_ERROR_STOP=1 -q \
  -v username="$BOOTSTRAP_ADMIN_USERNAME" \
  -v email="${BOOTSTRAP_ADMIN_EMAIL:-}" \
  -v document="${BOOTSTRAP_ADMIN_DOCUMENT:-ADMIN-$(date +%Y%m%d%H%M%S)}" \
  -v pw="$BOOTSTRAP_ADMIN_PASSWORD" \
  -v reset="$RESET" <<'SQL'
\set QUIET on
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Liquibase may have installed pgcrypto in whatever schema was its default (Neon),
-- which is not on this session's search_path: crypt()/gen_salt() would not resolve.
SELECT extnamespace::regnamespace::text AS pgcrypto_schema FROM pg_extension WHERE extname = 'pgcrypto' \gset
SELECT set_config('search_path', :'pgcrypto_schema' || ', ' || current_setting('search_path'), true);

SELECT EXISTS (SELECT 1 FROM "identity".app_user WHERE username = :'username') AS user_exists \gset

\if :user_exists
  \if :reset
    UPDATE "identity".app_user
       SET password_hash = crypt(:'pw', gen_salt('bf', 12)),
           must_change_password = TRUE,
           status = TRUE,
           deleted_at = NULL,
           updated_at = NOW()
     WHERE username = :'username';
    UPDATE "identity".person p
       SET status = TRUE, deleted_at = NULL, updated_at = NOW()
      FROM "identity".app_user u
     WHERE u.username = :'username' AND p.person_id = u.person_id;
  \else
    \echo 'The user already exists. Run again with --reset to set a new password.'
    ROLLBACK;
    \quit
  \endif
\else
  \if :reset
    \echo 'The user does not exist; run without --reset to create it.'
    ROLLBACK;
    \quit
  \endif
  WITH new_person AS (
    INSERT INTO "identity".person (person_id, document_number, name, last_name, email, status, created_at, row_version)
    VALUES (gen_random_uuid(), :'document', 'Administrador', 'FaceAttend', :'email', TRUE, NOW(), 1)
    RETURNING person_id
  )
  INSERT INTO "identity".app_user (user_id, person_id, username, password_hash, authentication_type, status, must_change_password, created_at, row_version)
  SELECT gen_random_uuid(), person_id, :'username', crypt(:'pw', gen_salt('bf', 12)), 'Local', TRUE, TRUE, NOW(), 1
    FROM new_person;
\endif

INSERT INTO "authorization".user_role (user_id, role_id, assignment_date, created_at, updated_at, row_version)
SELECT u.user_id, r.role_id, NOW(), NOW(), NOW(), 1
  FROM "identity".app_user u
  JOIN "authorization".role r ON r.role_name = 'Super Administrador'
 WHERE u.username = :'username'
ON CONFLICT DO NOTHING;

COMMIT;
SELECT 'Administrator ready: ' || :'username' || ' (password change required on first sign-in)' AS result;
SQL
