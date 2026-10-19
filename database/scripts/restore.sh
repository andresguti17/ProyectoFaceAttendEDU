#!/usr/bin/env bash
# FaceAttend EDU — restaura un backup hecho con backup.sh.
#
# Uso:
#   ./database/scripts/restore.sh database/backups/20261008-061500
#
# ADVERTENCIA: sobrescribe los datos actuales de las 2 bases. Pide
# confirmación salvo que se pase FORCE=1.

set -euo pipefail

DIR="${1:?Uso: restore.sh <carpeta-de-backup>}"
[ -d "$DIR" ] || { echo "No existe: $DIR" >&2; exit 1; }

if [ "${FORCE:-0}" != "1" ]; then
  read -r -p "Esto sobrescribe faceattend_db y MongoDB con el backup de $DIR. ¿Continuar? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { echo "Cancelado."; exit 1; }
fi

docker cp "$DIR/faceattend_db.dump" faceattend-postgres:/tmp/faceattend_db.dump
docker exec faceattend-postgres pg_restore --clean --if-exists -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-faceattend_db}" /tmp/faceattend_db.dump
docker exec faceattend-postgres rm /tmp/faceattend_db.dump

docker cp "$DIR/mongo.archive.gz" faceattend-mongo:/tmp/mongo.archive
docker exec faceattend-mongo mongorestore --drop --gzip --archive=/tmp/mongo.archive \
  --username "${MONGO_USER:-mongoadmin}" --password "${MONGO_PASSWORD:-mongopass}" --authenticationDatabase admin
docker exec faceattend-mongo rm /tmp/mongo.archive

echo "Restored from $DIR"
