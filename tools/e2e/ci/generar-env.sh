#!/usr/bin/env bash
# FaceAttend EDU — .env desechable para el stack E2E del CI: parte de .env.example y llena
# cada secreto con un valor aleatorio generado en el momento. Nada de esto se versiona ni
# se reutiliza: el stack y sus volúmenes se borran al terminar el job.
#
#   bash tools/e2e/ci/generar-env.sh [.env]
set -euo pipefail

OUT=${1:-.env}
hex() { openssl rand -hex "${1:-24}"; }
b64() { openssl rand -base64 32; }

declare -A V=(
  [POSTGRES_PASSWORD]=$(hex)
  [IDENTITY_DB_PASSWORD]=$(hex) [AUTHORIZATION_DB_PASSWORD]=$(hex) [ACADEMIC_DB_PASSWORD]=$(hex)
  [SCHEDULING_DB_PASSWORD]=$(hex) [ATTENDANCE_DB_PASSWORD]=$(hex) [CONFIGURATION_DB_PASSWORD]=$(hex)
  [QUALITY_DB_PASSWORD]=$(hex) [NOTIFICATION_DB_PASSWORD]=$(hex)
  [MONGO_USER]=faceattend [MONGO_PASSWORD]=$(hex)
  [MINIO_ROOT_USER]=faceattend [MINIO_ROOT_PASSWORD]=$(hex) [MINIO_KMS_SECRET_KEY]="faceattend-key:$(b64)"
  [BIOMETRIC_LIVENESS_CHALLENGE_SECRET]=$(hex 32) [BIOMETRIC_ENCRYPTION_KEY]=$(b64)
  [PII_ENCRYPTION_KEY]=$(b64) [PII_HASH_KEY]=$(b64)
  [EMAIL_INTERNAL_TOKEN]=$(hex 32)
  [SEED_PASSWORD]="Seed$(hex 8)#1"
  # Sin servidor SMTP en el runner: los correos fallan solos, sin bloquear nada.
  [SMTP_HOST]=127.0.0.1 [PUSH_ENABLED]=false
  # Todo el tráfico de la prueba sale de una sola IP.
  [KONG_RATE_LIMIT_PER_MINUTE]=100000
)

: > "$OUT"
while IFS= read -r line || [[ -n "$line" ]]; do
  key=${line%%=*}
  if [[ "$line" =~ ^[A-Z0-9_]+= && -n "${V[$key]+x}" ]]; then
    printf '%s=%s\n' "$key" "${V[$key]}" >> "$OUT"
    unset "V[$key]"
  else
    printf '%s\n' "$line" >> "$OUT"
  fi
done < .env.example
for key in "${!V[@]}"; do printf '%s=%s\n' "$key" "${V[$key]}" >> "$OUT"; done
echo "generado $OUT con secretos aleatorios"
