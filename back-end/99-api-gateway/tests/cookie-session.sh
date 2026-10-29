#!/usr/bin/env bash
# Sesión web en cookie (S-10, parte 2): casos de la sección 6 de docs/DISENO_S10_SESION_HTTPONLY.md contra el
# gateway real, con identity ya con el modo cookie. No imprime sesiones ni contraseñas.
#
#   FAE_TEST_USER=<usuario> FAE_TEST_PASSWORD=<contraseña> bash back-end/99-api-gateway/tests/cookie-session.sh
#
# Opcionales: FAE_API (http://localhost:8000/api/v1) y FAE_ORIGIN (un origen de KONG_CORS_ORIGINS, por defecto
# http://localhost:8090). Hace login y logout con esa cuenta (11 segundos de espera por la ventana de los servicios).
B=${FAE_API:-http://localhost:8000/api/v1}
O=${FAE_ORIGIN:-http://localhost:8090}
EVIL=https://evil.example
U=${FAE_TEST_USER:?define FAE_TEST_USER}
PW=${FAE_TEST_PASSWORD:?define FAE_TEST_PASSWORD}
LOGIN="{\"identifier\":\"$U\",\"password\":\"$PW\"}"
H=(-H 'Content-Type: application/json')
WEB=(-H 'X-Session-Mode: cookie' -H 'X-Requested-With: FaceAttend' -H "Origin: $O")
pass=0; fail=0
check() { # nombre esperado obtenido
  if [[ "$2" = "$3" ]]; then pass=$((pass+1)); printf 'OK    %-62s %s\n' "$1" "$3"; else fail=$((fail+1)); printf 'FALLA %-62s esperado %s, obtenido %s\n' "$1" "$2" "$3"; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
body() { curl -s "$@"; }
sid_of() { grep -i '^set-cookie: fae_session=' | head -1 | sed -E 's/^[Ss]et-[Cc]ookie: fae_session=([^;]*).*/\1/' | tr -d '\r'; }

# 1. login en modo cookie
R=$(curl -si -X POST "$B/auth/login" "${H[@]}" "${WEB[@]}" -d "$LOGIN")
SID=$(echo "$R" | sid_of)
check "login web: 200" 200 "$(echo "$R" | head -1 | awk '{print $2}')"
check "login web: llega la cookie" yes "$([[ -n "$SID" ]] && echo yes || echo no)"
check "login web: la cookie es HttpOnly" yes "$(echo "$R" | grep -i '^set-cookie: fae_session' | grep -qi httponly && echo yes || echo no)"
check "login web: el cuerpo trae sessionId nulo" yes "$(echo "$R" | tail -1 | grep -q "\"sessionId\":null" && echo yes || echo no)"
# 2. login en modo cookie sin cabecera anti-CSRF ni Origin
R2=$(curl -si -X POST "$B/auth/login" "${H[@]}" -H 'X-Session-Mode: cookie' -d "$LOGIN")
check "login web sin X-Requested-With ni Origin: 403" 403 "$(echo "$R2" | head -1 | awk '{print $2}')"
check "…con el código CSRF_REJECTED" yes "$(echo "$R2" | grep -q CSRF_REJECTED && echo yes || echo no)"
# 3. login móvil
R3=$(curl -s -X POST "$B/auth/login" "${H[@]}" -d "$LOGIN")
BEARER=$(echo "$R3" | sed -E 's/.*"sessionId":"([^"]+)".*/\1/')
check "login móvil: el id sigue en el cuerpo" yes "$(echo "$BEARER" | grep -Eq '^[0-9a-f-]{36}$' && echo yes || echo no)"
# 4-6. lecturas solo con cookie
check "GET /auth/session solo con cookie: 200" 200 "$(code "$B/auth/session" -H "Cookie: fae_session=$SID")"
check "…el cuerpo no devuelve el id" no "$(body "$B/auth/session" -H "Cookie: fae_session=$SID" | grep -q "$SID" && echo yes || echo no)"
check "GET /schools (academic) solo con cookie: 200" 200 "$(code "$B/schools?limit=1" -H "Cookie: fae_session=$SID")"
check "GET con cookie desde Origin ajeno (lectura): 200" 200 "$(code "$B/schools?limit=1" -H "Cookie: fae_session=$SID" -H "Origin: $EVIL")"
# 7-10. escritura (POST /auth/evaluate no cambia nada)
EV='{"userId":"00000000-0000-0000-0000-000000000000","permission":"x"}'
check "POST con cookie sin X-Requested-With: 403" 403 "$(code -X POST "$B/auth/evaluate" "${H[@]}" -H "Cookie: fae_session=$SID" -H "Origin: $O" -d "$EV")"
check "POST con cookie y X-Requested-With pero Origin ajeno: 403" 403 "$(code -X POST "$B/auth/evaluate" "${H[@]}" -H "Cookie: fae_session=$SID" -H 'X-Requested-With: FaceAttend' -H "Origin: $EVIL" -d "$EV")"
check "POST con cookie, cabecera y Origin permitido: no 403" no "$([[ "$(code -X POST "$B/auth/evaluate" "${H[@]}" -H "Cookie: fae_session=$SID" -H 'X-Requested-With: FaceAttend' -H "Origin: $O" -d "$EV")" = 403 ]] && echo yes || echo no)"
check "POST móvil con Bearer sin cabeceras web: no 403" no "$([[ "$(code -X POST "$B/auth/evaluate" "${H[@]}" -H "Authorization: Bearer $BEARER" -d "$EV")" = 403 ]] && echo yes || echo no)"
# 11-13. cookies inválidas y prioridad de Authorization
check "cookie que no es un UUID: 401" 401 "$(code "$B/schools?limit=1" -H 'Cookie: fae_session=hola')"
check "cookie con un UUID inventado: 401" 401 "$(code "$B/schools?limit=1" -H 'Cookie: fae_session=11111111-2222-4333-8444-555555555555')"
check "Authorization manda sobre una cookie inválida: 200" 200 "$(code "$B/schools?limit=1" -H "Authorization: Bearer $BEARER" -H 'Cookie: fae_session=hola')"
check "otra cookie que termina en fae_session no cuenta: 401" 401 "$(code "$B/schools?limit=1" -H "Cookie: xfae_session=$SID")"
# 14. CORS
P=$(curl -si -X OPTIONS "$B/auth/login" -H "Origin: $O" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type,x-requested-with,x-session-mode')
check "preflight desde el origen permitido: 2xx" yes "$(echo "$P" | head -1 | grep -Eq ' 20[0-9]' && echo yes || echo no)"
check "…permite X-Requested-With y X-Session-Mode" yes "$(echo "$P" | grep -i '^access-control-allow-headers' | grep -qi 'x-requested-with' && echo "$P" | grep -i '^access-control-allow-headers' | grep -qi 'x-session-mode' && echo yes || echo no)"
check "…con credenciales" true "$(echo "$P" | grep -i '^access-control-allow-credentials' | tr -d '\r' | awk '{print tolower($2)}')"
P2=$(curl -si -X OPTIONS "$B/auth/login" -H "Origin: $EVIL" -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: x-requested-with')
check "preflight desde un origen ajeno: sin Allow-Origin" no "$(echo "$P2" | grep -qi '^access-control-allow-origin' && echo yes || echo no)"
# 15. logout por cookie y efecto inmediato
L=$(curl -si -X POST "$B/auth/logout" "${WEB[@]}" -H "Cookie: fae_session=$SID")
check "logout por cookie: 204" 204 "$(echo "$L" | head -1 | awk '{print $2}')"
check "…la cookie se borra (Max-Age=0)" yes "$(echo "$L" | grep -i '^set-cookie: fae_session' | grep -qi 'max-age=0' && echo yes || echo no)"
check "…y la misma cookie ya no sirve en identity al instante: 401" 401 "$(code "$B/auth/session" -H "Cookie: fae_session=$SID")"
check "logout por cookie sin cabecera anti-CSRF: 403" 403 "$(code -X POST "$B/auth/logout" -H "Cookie: fae_session=$BEARER" -H "Origin: $O")"
sleep 11
check "…y en los demás servicios tras su ventana de 10 s: 401" 401 "$(code "$B/schools?limit=1" -H "Cookie: fae_session=$SID")"
# 16. refresh por cookie
R4=$(curl -si -X POST "$B/auth/login" "${H[@]}" "${WEB[@]}" -d "$LOGIN"); S2=$(echo "$R4" | sid_of)
RF=$(curl -si -X POST "$B/auth/refresh" "${WEB[@]}" -H "Cookie: fae_session=$S2")
S3=$(echo "$RF" | sid_of)
check "refresh por cookie: 200 y cookie nueva distinta" yes "$([[ "$(echo "$RF" | head -1 | awk '{print $2}')" = 200 && -n "$S3" && "$S3" != "$S2" ]] && echo yes || echo no)"
check "…la cookie nueva funciona: 200" 200 "$(code "$B/auth/session" -H "Cookie: fae_session=$S3")"
check "…la anterior ya no: 401" 401 "$(code "$B/auth/session" -H "Cookie: fae_session=$S2")"
# limpieza
curl -s -o /dev/null -X POST "$B/auth/logout" "${WEB[@]}" -H "Cookie: fae_session=$S3"
curl -s -o /dev/null -X POST "$B/auth/logout" -H "Authorization: Bearer $BEARER"
echo; echo "Resultado: $pass bien, $fail con falla"
[[ "$fail" = 0 ]]
