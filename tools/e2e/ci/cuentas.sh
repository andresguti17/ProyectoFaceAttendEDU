#!/usr/bin/env bash
# FaceAttend EDU — cuentas de Super Administrador para el stack E2E, con
# database/scripts/bootstrap-admin.sh (las migraciones no traen ninguna):
#
#   e2e.admin          la usan los flujos (E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD)
#   e2e.seed           la usa tools/seed-api-test-data (BOOTSTRAP_USERNAME / BOOTSTRAP_PASSWORD)
#   e2e.svc.onboarding cuenta de servicio del alta pública de sedes (ONBOARDING_SERVICE_USER_ID)
#   e2e.svc.notify     cuenta de servicio de ms-notification (marca los ausentes al cerrar)
#
# Contraseñas aleatorias de esta ejecución. Las de servicio se añaden al .env (luego hay que
# recrear ms-identity y ms-notification); las de e2e.admin y e2e.seed se escriben en OUT_ENV
# (por defecto .env.e2e, ignorado por git). Si una cuenta ya existe se le pone una
# clave nueva (--reset), así sirve también para repetir la prueba en un stack local.
#
#   bash tools/e2e/ci/cuentas.sh [.env] [.env.e2e]
set -euo pipefail

ENV_FILE=${1:-.env}
OUT_ENV=${2:-.env.e2e}
BOOT=database/scripts/bootstrap-admin.sh
PSQL=${PSQL:-docker exec -i faceattend-postgres psql -U postgres -d faceattend_db}

# bootstrap-admin.sh pide 12+ caracteres; identity.password_policy, como mucho 20.
pw() { printf 'E2e%s#7' "$(openssl rand -hex 7)"; }

# bootstrap-admin.sh exige un correo al crear; si la cuenta ya existe, --reset.
admin() {
  local user=$1 pass=$2
  if ! out=$(BOOTSTRAP_ADMIN_USERNAME=$user BOOTSTRAP_ADMIN_EMAIL="$user@example.test" BOOTSTRAP_ADMIN_PASSWORD=$pass PSQL=$PSQL bash "$BOOT" 2>&1) \
     || grep -q 'already exists' <<<"$out"; then
    BOOTSTRAP_ADMIN_USERNAME=$user BOOTSTRAP_ADMIN_PASSWORD=$pass PSQL=$PSQL bash "$BOOT" --reset > /dev/null
  fi
  $PSQL -tA -c "SELECT user_id FROM \"identity\".app_user WHERE username = '$user'" | tr -d '[:space:]'
}

set_env() { # clave valor: reemplaza o añade la línea en ENV_FILE
  local tmp
  tmp=$(mktemp)
  grep -v "^$1=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}

ADMIN_PW=$(pw)
admin e2e.admin "$ADMIN_PW" > /dev/null
SEED_PW=$(pw)
admin e2e.seed "$SEED_PW" > /dev/null
ONBOARDING_ID=$(admin e2e.svc.onboarding "$(pw)")
NOTIFY_PW=$(pw)
admin e2e.svc.notify "$NOTIFY_PW" > /dev/null

set_env ONBOARDING_SERVICE_USER_ID "$ONBOARDING_ID"
set_env NOTIFICATION_SERVICE_USERNAME e2e.svc.notify
set_env NOTIFICATION_SERVICE_PASSWORD "$NOTIFY_PW"
umask 077
printf 'E2E_ADMIN_USERNAME=e2e.admin\nE2E_ADMIN_PASSWORD=%s\nBOOTSTRAP_USERNAME=e2e.seed\nBOOTSTRAP_PASSWORD=%s\n' "$ADMIN_PW" "$SEED_PW" > "$OUT_ENV"
echo "cuentas e2e listas (onboarding: $ONBOARDING_ID); recrea ms-identity y ms-notification para que las lean"
