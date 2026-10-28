#!/usr/bin/env bash
# FaceAttend EDU — restaura un backup hecho con backup.sh.
#
# Uso:
#   ./database/scripts/restore.sh database/backups/20261008-061500
#   BACKUP_PASSPHRASE='…' ./database/scripts/restore.sh <carpeta>   # si el backup está cifrado (.enc)
#
# Variables opcionales: PG_CONTAINER (faceattend-postgres), MONGO_CONTAINER
# (faceattend-mongo), POSTGRES_USER, POSTGRES_DB, BACKUP_PASSPHRASE.
#
# ADVERTENCIA: sobrescribe los datos actuales de las 2 bases. Pide
# confirmación salvo que se pase FORCE=1.

set -euo pipefail

DIR="${1:?Uso: restore.sh <carpeta-de-backup>}"
[[ -d "$DIR" ]] || { echo "No existe: $DIR" >&2; exit 1; }
# En Git Bash (Windows) no se convierten rutas solas (docker las rompería) y los binarios nativos
# no entienden /tmp/…: las rutas del host se pasan ya en formato Windows.
export MSYS_NO_PATHCONV=1
hostpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf %s "$1"; fi; }
PG_CONTAINER="${PG_CONTAINER:-faceattend-postgres}"
MONGO_CONTAINER="${MONGO_CONTAINER:-faceattend-mongo}"

if [[ "${FORCE:-0}" != "1" ]]; then
  read -r -p "Esto sobrescribe faceattend_db y MongoDB con el backup de $DIR. ¿Continuar? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { echo "Cancelado."; exit 1; }
fi

# Si el backup está cifrado, se descifra a una carpeta temporal que se borra al salir.
WORK="$DIR"
if [[ -f "$DIR/faceattend_db.dump.enc" || -f "$DIR/mongo.archive.gz.enc" ]]; then
  : "${BACKUP_PASSPHRASE:?El backup está cifrado: define BACKUP_PASSPHRASE}"
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  for f in faceattend_db.dump mongo.archive.gz; do
    BACKUP_PASSPHRASE="$BACKUP_PASSPHRASE" openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
      -pass env:BACKUP_PASSPHRASE -in "$(hostpath "$DIR/$f.enc")" -out "$(hostpath "$WORK/$f")"
  done
fi

docker cp "$(hostpath "$WORK")/faceattend_db.dump" "$PG_CONTAINER:/tmp/faceattend_db.dump"
docker exec "$PG_CONTAINER" pg_restore --clean --if-exists -U "${POSTGRES_USER:-postgres}" \
  -d "${POSTGRES_DB:-faceattend_db}" /tmp/faceattend_db.dump
docker exec "$PG_CONTAINER" rm /tmp/faceattend_db.dump

docker cp "$(hostpath "$WORK")/mongo.archive.gz" "$MONGO_CONTAINER:/tmp/mongo.archive"
docker exec "$MONGO_CONTAINER" mongorestore --drop --gzip --archive=/tmp/mongo.archive \
  --username "${MONGO_USER:?MONGO_USER is required}" --password "${MONGO_PASSWORD:?MONGO_PASSWORD is required}" --authenticationDatabase admin
docker exec "$MONGO_CONTAINER" rm /tmp/mongo.archive

echo "Restored from $DIR"
