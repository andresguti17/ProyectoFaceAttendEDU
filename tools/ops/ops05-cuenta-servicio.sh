#!/usr/bin/env bash
# OPS-05: crea la cuenta de servicio con la que ms-notification marca los ausentes al cerrar una clase
# (un Super Administrador dedicado) y escribe sus dos variables en tu .env.prod local.
#
#   NOTIFICATION_SERVICE_EMAIL=<correo institucional> bash tools/ops/ops05-cuenta-servicio.sh [.env.prod]
#
# Lo que hace, en orden:
#   1. Lee NEON_HOST, NEON_USER, NEON_PASSWORD y POSTGRES_DB del .env.prod (sin ejecutarlo).
#   2. Se niega a seguir si el archivo ya trae NOTIFICATION_SERVICE_USERNAME.
#   3. Genera una clave de 19 caracteres (la política permite como máximo 20) que NO se imprime.
#   4. Crea la cuenta con database/scripts/bootstrap-admin.sh, contra Neon, usando un psql en Docker
#      (no hace falta tener psql instalado). Si la cuenta ya existe, le pone la clave nueva (--reset).
#   5. Solo si lo anterior salió bien, añade NOTIFICATION_SERVICE_USERNAME y NOTIFICATION_SERVICE_PASSWORD
#      al .env.prod. La clave solo vive en ese archivo.
#
# Después tienes que subir el .env.prod al secret y desplegar (el script te lo recuerda):
#   gh secret set ENV_PROD_FILE --env production < .env.prod
#
# Opcionales: NOTIFICATION_SERVICE_USER (por defecto svc.notification) y OPS05_PSQL (el comando psql
# completo, solo para probar el script contra una base local en lugar de Neon).
set -euo pipefail

ENV_FILE=${1:-.env.prod}
SERVICE_USER=${NOTIFICATION_SERVICE_USER:-svc.notification}
: "${NOTIFICATION_SERVICE_EMAIL:?Define NOTIFICATION_SERVICE_EMAIL (correo institucional de la cuenta de servicio)}"
[[ -f "$ENV_FILE" ]] || { echo "No existe $ENV_FILE" >&2; exit 1; }

# Lee una variable del .env sin ejecutar el archivo (puede traer caracteres que el shell interpretaría).
get() { sed 's/\r$//' "$ENV_FILE" | grep -E "^$1=" | head -1 | cut -d= -f2- | sed -E "s/^(['\"])(.*)\1$/\2/" || true; }

if [[ -n "$(get NOTIFICATION_SERVICE_USERNAME)" ]]; then
  echo "$ENV_FILE ya trae NOTIFICATION_SERVICE_USERNAME: no hago nada." >&2
  exit 1
fi

if [[ -n "${OPS05_PSQL:-}" ]]; then
  PSQL_CMD=$OPS05_PSQL
else
  for v in NEON_HOST NEON_USER NEON_PASSWORD POSTGRES_DB; do
    [[ -n "$(get "$v")" ]] || { echo "Falta $v en $ENV_FILE" >&2; exit 1; }
  done
  export PGPASSWORD PGSSLMODE=require
  PGPASSWORD=$(get NEON_PASSWORD)
  PSQL_CMD="docker run --rm -i -e PGPASSWORD -e PGSSLMODE postgres:17-alpine psql -h $(get NEON_HOST) -U $(get NEON_USER) -d $(get POSTGRES_DB) -v ON_ERROR_STOP=1"
fi

PASSWORD=$(printf 'Ntf%s#7' "$(openssl rand -hex 7)")
BOOT="$(cd "$(dirname "$0")/../.." && pwd)/database/scripts/bootstrap-admin.sh"

echo "Creando la cuenta $SERVICE_USER ..."
fail() {
  echo "No se pudo dejar lista la cuenta; $ENV_FILE no se modificó. Salida:" >&2
  printf '%s\n' "$1" | sed "s/$PASSWORD/<clave>/g" >&2
  exit 1
}
# bootstrap-admin.sh termina con código 0 aunque la cuenta ya exista (avisa y no cambia nada): por eso se
# mira lo que imprime, no solo el código, y solo se escribe el .env si imprimió que la cuenta quedó lista.
rc=0
out=$(BOOTSTRAP_ADMIN_USERNAME=$SERVICE_USER BOOTSTRAP_ADMIN_EMAIL=$NOTIFICATION_SERVICE_EMAIL \
  BOOTSTRAP_ADMIN_PASSWORD=$PASSWORD PSQL=$PSQL_CMD bash "$BOOT" 2>&1) || rc=$?
if grep -q 'The user already exists' <<<"$out"; then
  echo "La cuenta ya existía: le pongo la clave nueva y la dejo activa como Super Administrador."
  rc=0
  out=$(BOOTSTRAP_ADMIN_USERNAME=$SERVICE_USER BOOTSTRAP_ADMIN_PASSWORD=$PASSWORD PSQL=$PSQL_CMD \
    bash "$BOOT" --reset 2>&1) || rc=$?
fi
if [[ $rc -ne 0 ]] || ! grep -q 'Administrator ready' <<<"$out"; then fail "$out"; fi

{
  printf '\n# OPS-05: cuenta de servicio de ms-notification (creada con tools/ops/ops05-cuenta-servicio.sh)\n'
  printf 'NOTIFICATION_SERVICE_USERNAME=%s\n' "$SERVICE_USER"
  printf 'NOTIFICATION_SERVICE_PASSWORD=%s\n' "$PASSWORD"
} >> "$ENV_FILE"

echo "Listo: la cuenta existe y $ENV_FILE ya tiene sus dos variables (la clave no se mostró)."
echo "Siguiente paso, subir el archivo al secret y desplegar:"
echo "  gh secret set ENV_PROD_FILE --env production < $ENV_FILE"
