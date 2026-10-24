#!/usr/bin/env bash
# FaceAttend EDU — rotates the MongoDB root password of an existing volume.
#
# MONGO_INITDB_ROOT_* only apply the first time the volume is created, so
# changing MONGO_PASSWORD in .env does not change the real password. Run this
# on the host (e.g. the EC2 server) with both values in the environment, then
# update MONGO_PASSWORD in the env file and recreate the services:
#
#   MONGO_USER=... MONGO_OLD_PASSWORD=... MONGO_NEW_PASSWORD=... \
#     ./database/scripts/rotate-mongo-password.sh
#   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate mongodb ms-biometric
#
# The values are read from the environment and passed through stdin, so they
# never show up in the command line of the container.

set -euo pipefail

: "${MONGO_USER:?MONGO_USER is required}"
: "${MONGO_OLD_PASSWORD:?MONGO_OLD_PASSWORD is required}"
: "${MONGO_NEW_PASSWORD:?MONGO_NEW_PASSWORD is required}"
if (( ${#MONGO_NEW_PASSWORD} < 16 )); then
  echo "MONGO_NEW_PASSWORD must have at least 16 characters" >&2
  exit 1
fi
CONTAINER="${MONGO_CONTAINER:-faceattend-mongo}"

docker exec -i -e MONGO_USER -e MONGO_OLD_PASSWORD -e MONGO_NEW_PASSWORD "$CONTAINER" \
   mongosh --quiet --nodb <<'JS'
const conn = new Mongo("mongodb://127.0.0.1:27017");
const admin = conn.getDB("admin");
admin.auth(process.env.MONGO_USER, process.env.MONGO_OLD_PASSWORD);
admin.changeUserPassword(process.env.MONGO_USER, process.env.MONGO_NEW_PASSWORD);
print("MongoDB password rotated for " + process.env.MONGO_USER);
JS
