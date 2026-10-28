#!/usr/bin/env bash
# FaceAttend EDU — prueba que un backup se puede restaurar (OPS-01).
#
# Levanta contenedores DESECHABLES (fae-vr-*, sin puertos publicados) de Postgres y MongoDB,
# les carga datos de prueba, los respalda con backup.sh (cifrado con una passphrase de prueba),
# restaura en otro par vacío con restore.sh y compara los datos. No toca el stack del proyecto
# (faceattend-*). Borra todo al terminar.
#
# Uso:
#   ./database/scripts/verify-restore.sh
#
# Requiere docker y openssl. Variables opcionales: PG_IMAGE, MONGO_IMAGE.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_IMAGE="${PG_IMAGE:-postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b}"
MONGO_IMAGE="${MONGO_IMAGE:-mongo:7@sha256:8bb4442761a63a8dda452744082cdac9644b429807eb977b42324a63cef59ca4}"
RUN="fae-vr-$$"
WORK="$(mktemp -d)"
export POSTGRES_USER=postgres POSTGRES_DB=faceattend_db
export MONGO_USER=root MONGO_PASSWORD="vr-$RANDOM-$RANDOM"
PG_PASS="vr-$RANDOM-$RANDOM"
export BACKUP_PASSPHRASE="vr-passphrase-$RANDOM-$RANDOM"

cleanup() {
  docker rm -f "$RUN-pg-src" "$RUN-mongo-src" "$RUN-pg-dst" "$RUN-mongo-dst" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

start_pair() { # $1 = src|dst
  docker run -d --name "$RUN-pg-$1" -e POSTGRES_PASSWORD="$PG_PASS" -e POSTGRES_DB="$POSTGRES_DB" "$PG_IMAGE" >/dev/null
  docker run -d --name "$RUN-mongo-$1" -e MONGO_INITDB_ROOT_USERNAME="$MONGO_USER" -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_PASSWORD" "$MONGO_IMAGE" >/dev/null
}
wait_ready() { # $1 = src|dst
  for _ in $(seq 1 60); do
    # pg_isready también responde durante el arranque temporal de initdb; una consulta real lo descarta.
    if docker exec "$RUN-pg-$1" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc 'select 1' >/dev/null 2>&1 &&
       docker exec "$RUN-mongo-$1" mongosh --quiet -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "Timeout waiting for the $1 containers" >&2
  return 1
}
psql_in() { docker exec "$RUN-pg-$1" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$2"; }
mongo_in() { docker exec "$RUN-mongo-$1" mongosh --quiet -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin --eval "$2"; }

echo "1/5 Starting the source containers"
start_pair src
wait_ready src

echo "2/5 Seeding test data"
psql_in src "create schema identity;
  create table identity.person (person_id serial primary key, document_number text not null);
  insert into identity.person (document_number) select 'DOC-' || g from generate_series(1, 25) g;
  create schema attendance;
  create table attendance.attendance_record (id serial primary key, status text);
  insert into attendance.attendance_record (status) select 'Present' from generate_series(1, 40);" >/dev/null
mongo_in src "db.getSiblingDB('biometric').facial_embedding.insertMany(Array.from({length: 12}, (_, i) => ({person_id: 'p' + i, template: 'secret-template-' + i})))" >/dev/null
SRC_PG="$(psql_in src "select (select count(*) from identity.person) || ',' || (select count(*) from attendance.attendance_record) || ',' || (select md5(string_agg(document_number, ',' order by person_id)) from identity.person)")"
SRC_MONGO="$(mongo_in src "db.getSiblingDB('biometric').facial_embedding.countDocuments({})")"
echo "    postgres: $SRC_PG | mongo docs: $SRC_MONGO"

echo "3/5 Backing up (encrypted)"
PG_CONTAINER="$RUN-pg-src" MONGO_CONTAINER="$RUN-mongo-src" BACKUP_DIR="$WORK" bash "$HERE/backup.sh" >/dev/null
BACKUP="$(find "$WORK" -mindepth 1 -maxdepth 1 -type d | head -1)"
[[ -f "$BACKUP/faceattend_db.dump.enc" && -f "$BACKUP/mongo.archive.gz.enc" ]] || { echo "FAIL: encrypted backup files missing" >&2; exit 1; }
[[ ! -f "$BACKUP/faceattend_db.dump" && ! -f "$BACKUP/mongo.archive.gz" ]] || { echo "FAIL: plaintext dump left next to the encrypted one" >&2; exit 1; }
if grep -aq "DOC-1" "$BACKUP/faceattend_db.dump.enc" || grep -aq "secret-template" "$BACKUP/mongo.archive.gz.enc"; then
  echo "FAIL: plaintext found inside the encrypted backup" >&2; exit 1
fi
echo "    encrypted files present, no plaintext inside"

echo "4/5 Restoring into empty containers"
start_pair dst
wait_ready dst
FORCE=1 PG_CONTAINER="$RUN-pg-dst" MONGO_CONTAINER="$RUN-mongo-dst" bash "$HERE/restore.sh" "$BACKUP" >/dev/null

echo "5/5 Comparing"
DST_PG="$(psql_in dst "select (select count(*) from identity.person) || ',' || (select count(*) from attendance.attendance_record) || ',' || (select md5(string_agg(document_number, ',' order by person_id)) from identity.person)")"
DST_MONGO="$(mongo_in dst "db.getSiblingDB('biometric').facial_embedding.countDocuments({})")"
echo "    postgres: $DST_PG | mongo docs: $DST_MONGO"
[[ "$SRC_PG" == "$DST_PG" && "$SRC_MONGO" == "$DST_MONGO" ]] || { echo "FAIL: restored data differs from the source" >&2; exit 1; }

# Una passphrase equivocada no debe producir un restore "a medias".
if FORCE=1 BACKUP_PASSPHRASE=wrong PG_CONTAINER="$RUN-pg-dst" MONGO_CONTAINER="$RUN-mongo-dst" bash "$HERE/restore.sh" "$BACKUP" >/dev/null 2>&1; then
  echo "FAIL: restore succeeded with a wrong passphrase" >&2; exit 1
fi
DST_AFTER="$(psql_in dst "select count(*) from identity.person")"
[[ "$DST_AFTER" == "25" ]] || { echo "FAIL: a failed restore altered the data" >&2; exit 1; }
echo "    wrong passphrase rejected, data untouched"

echo "OK: backup, encryption and restore verified"
