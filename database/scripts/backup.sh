#!/usr/bin/env bash
# FaceAttend EDU — backup de las 2 bases de datos del stack.
#
# No hay retención/backup automático hoy: `docker compose down -v` borra los
# volúmenes sin preguntar dos veces. Este script hace un dump lógico de cada
# base dentro de su propio contenedor y lo copia al host en BACKUP_DIR.
#
# Uso:
#   ./database/scripts/backup.sh                  # vuelca a database/backups/<timestamp>/
#   BACKUP_DIR=/mnt/backups ./database/scripts/backup.sh
#   BACKUP_PASSPHRASE='…' ./database/scripts/backup.sh   # cifra los volcados (AES-256, .enc)
#
# Variables opcionales: PG_CONTAINER (faceattend-postgres), MONGO_CONTAINER
# (faceattend-mongo), POSTGRES_USER, POSTGRES_DB, BACKUP_PASSPHRASE.
# El volcado de Postgres y el de MongoDB contienen datos personales y plantillas
# biométricas (cifradas por la aplicación): cífralos si salen del servidor.
#
# Requiere que el stack esté arriba (docker compose up -d). Probar que un backup
# se puede restaurar: ./database/scripts/verify-restore.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../backups" && pwd)}"
PG_CONTAINER="${PG_CONTAINER:-faceattend-postgres}"
MONGO_CONTAINER="${MONGO_CONTAINER:-faceattend-mongo}"
# En Git Bash (Windows) no se convierten rutas solas (docker las rompería) y los binarios nativos
# no entienden /tmp/…: las rutas del host se pasan ya en formato Windows.
export MSYS_NO_PATHCONV=1
hostpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf %s "$1"; fi; }
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT"

echo "Backing up to $OUT"

# ── faceattend_db (8 schemas: identity, authorization, academic, scheduling,
#    attendance, biometric, configuration, notification) ──
docker exec "$PG_CONTAINER" pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-faceattend_db}" \
  --format=custom --file=/tmp/faceattend_db.dump
docker cp "$PG_CONTAINER:/tmp/faceattend_db.dump" "$(hostpath "$OUT")/faceattend_db.dump"
docker exec "$PG_CONTAINER" rm /tmp/faceattend_db.dump

# ── MongoDB (embeddings biométricos de ms-biometric, incluida la biometría
#    web fusionada desde el antiguo 10-ms-face-auth) ──
docker exec "$MONGO_CONTAINER" mongodump \
  --username "${MONGO_USER:?MONGO_USER is required}" --password "${MONGO_PASSWORD:?MONGO_PASSWORD is required}" \
  --authenticationDatabase admin --archive=/tmp/mongo.archive --gzip
docker cp "$MONGO_CONTAINER:/tmp/mongo.archive" "$(hostpath "$OUT")/mongo.archive.gz"
docker exec "$MONGO_CONTAINER" rm /tmp/mongo.archive

# ── MinIO (soportes de justificación). Los objetos están cifrados (SSE-S3):
#    restaurarlos exige el mismo MINIO_KMS_SECRET_KEY. ──
if docker ps --format '{{.Names}}' | grep -qx faceattend-minio; then
  docker cp faceattend-minio:/data "$(hostpath "$OUT")/minio-data"
fi

# ── Cifrado opcional de los dos volcados (la passphrase no se guarda aquí:
#    sin ella el backup no se puede restaurar). ──
if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  for f in "$OUT/faceattend_db.dump" "$OUT/mongo.archive.gz"; do
    BACKUP_PASSPHRASE="$BACKUP_PASSPHRASE" openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
      -pass env:BACKUP_PASSPHRASE -in "$(hostpath "$f")" -out "$(hostpath "$f.enc")"
    rm -f "$f"
  done
  echo "Encrypted with AES-256 (openssl, PBKDF2): keep BACKUP_PASSPHRASE apart from the backup."
fi

echo "Done: $OUT"
if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "  faceattend_db.dump.enc  mongo.archive.gz.enc  (restore.sh los descifra con BACKUP_PASSPHRASE)"
else
  echo "  faceattend_db.dump  (restore: pg_restore --clean -d faceattend_db)"
  echo "  mongo.archive.gz    (restore: mongorestore --gzip --archive=...)"
fi
echo "  minio-data/         (restore: docker cp minio-data/. faceattend-minio:/data, same MINIO_KMS_SECRET_KEY)"
