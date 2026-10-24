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
#
# Requiere que el stack esté arriba (docker compose up -d).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../backups" && pwd)}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT"

echo "Backing up to $OUT"

# ── faceattend_db (8 schemas: identity, authorization, academic, scheduling,
#    attendance, biometric, configuration, notification) ──
docker exec faceattend-postgres pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-faceattend_db}" \
  --format=custom --file=/tmp/faceattend_db.dump
docker cp faceattend-postgres:/tmp/faceattend_db.dump "$OUT/faceattend_db.dump"
docker exec faceattend-postgres rm /tmp/faceattend_db.dump

# ── MongoDB (embeddings biométricos de ms-biometric, incluida la biometría
#    web fusionada desde el antiguo 10-ms-face-auth) ──
docker exec faceattend-mongo mongodump \
  --username "${MONGO_USER:?MONGO_USER is required}" --password "${MONGO_PASSWORD:?MONGO_PASSWORD is required}" \
  --authenticationDatabase admin --archive=/tmp/mongo.archive --gzip
docker cp faceattend-mongo:/tmp/mongo.archive "$OUT/mongo.archive.gz"
docker exec faceattend-mongo rm /tmp/mongo.archive

# ── MinIO (soportes de justificación). Los objetos están cifrados (SSE-S3):
#    restaurarlos exige el mismo MINIO_KMS_SECRET_KEY. ──
if docker ps --format '{{.Names}}' | grep -qx faceattend-minio; then
  docker cp faceattend-minio:/data "$OUT/minio-data"
fi

echo "Done: $OUT"
echo "  faceattend_db.dump  (restore: pg_restore --clean -d faceattend_db)"
echo "  mongo.archive.gz    (restore: mongorestore --gzip --archive=...)"
echo "  minio-data/         (restore: docker cp minio-data/. faceattend-minio:/data, same MINIO_KMS_SECRET_KEY)"
