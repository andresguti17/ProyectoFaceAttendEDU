---
name: faceattend-api-conventions
description: Use when designing or consuming a REST endpoint across FaceAttend-EDU's 9 services, handling authentication/session headers, pagination, or error responses.
---

# Convenciones de API y autenticación

## Overview
Todo el tráfico cruza Kong (`99-api-gateway`, puerto 8000). La autenticación real **NO es JWT**: es un `sessionId` UUID opaco emitido por `01-ms-identity`, enviado como `Authorization: Bearer <sessionId>`, validado en el edge por Kong (`pre-function` de introspección contra identity, una llamada por request, sin caché) y revalidado + RBAC en cada uno de los 9 servicios.

**Advertencia de documentación contradictoria:** `fae-docs/12-ux-ui/README.md` afirma erróneamente "JWT issued via Kong gateway" / "Kong JWT". Es incorrecto — confirmado contra código real en `fae-docs/07-api/authentication.md` y `fae-docs/05-architecture/overview.md` (Kong no tiene plugin `jwt` ni consumers). **Nunca implementes JWT para este proyecto**; usa siempre el patrón sessionId opaco.

## Cuándo usar
Vas a crear un endpoint nuevo, consumirlo desde frontend, o decidir cómo paginar/manejar errores.

## Convenciones verificadas
- Rutas: `/api/v1/` únicamente, kebab-case plural, sin verbos (transiciones vía sub-recursos: `POST .../open|close|cancel`, `PATCH .../review|status|resolve`).
- IDs cross-context en payload siempre UUID; catálogos locales INT/BIGINT/SMALLINT (coherente con AGENTS.md §2.3 — no lo reinterpretes aquí).
- Guard de sesión por stack (4 implementaciones separadas, deuda técnica documentada; no las unifiques sin que el usuario lo pida): `AuthTokenFilter` (Java), `registerAuthGuard` (TS), `require_permission` (Python), `AuthMiddleware` (Go).
- Login siempre responde genérico `401 Invalid email or password` (anti-enumeración), exista o no el usuario.
- bcrypt costo 12; recuperación de contraseña: código de 6 dígitos, TTL 10 min, 5 intentos, cooldown 60s, hash SHA-256 con comparación constant-time — implementado en `01-ms-identity` (entrega real por SMTP no verificada end-to-end).
- **Paginación NO homogénea** — verifícala en el servicio concreto antes de asumir un patrón: Java identity usa `page/limit`; el resto de Java no pagina; TS usa `limit/offset` + header `x-total-count`; Go usa `limit/offset`; Python (biometric) no pagina.
- Envelope de error canónico pretendido `{error,message,details?,traceId?}`, pero cada stack tiene su formato real propio — ver `fae-docs/07-api/error-catalog.md` antes de asumir un formato.
- Frontend (Web/Mobile): el `apiClient.js` de cada app ya desenvuelve `{data,meta}` y adjunta el Bearer — reutilízalo, no construyas llamadas `fetch` nuevas desde cero (ver skill `faceattend-frontend-mvvm`).

## Restricciones
- No implementes JWT ni asumas plugin `jwt` de Kong.
- No inventes un formato de error "unificado" que no exista en el stack que estás tocando; sigue el real de ese servicio.
- Datos biométricos nunca van en claro en ningún payload de API ni en logs (Ley 1581/2012 + GDPR, ver también skill `faceattend-biometric-service`).

## Verificación
```bash
curl -i http://localhost:8000/api/v1/<recurso>   # via Kong
```
Confirma manualmente: código de estado, header `Authorization` requerido, forma real de paginación/error contra `fae-docs/07-api/*.md` y el código del servicio, no contra supuestos.

## Dudas/pendientes
- `fae-docs/09-microservices/event-catalog.md`, `data-ownership-matrix.md` y `dependency-map.md` están desactualizados (mencionan un "Audit Service" eliminado y un `RoleCreated` con `schoolId` que contradice que `role` es global) — para eventos de dominio usa `fae-docs/02-domain/domain-events.md`, no esos tres archivos.
- `fae-docs/05-architecture/overview.md` y `pattern-guide.md` se contradicen sobre si Circuit Breaker/Outbox/Saga están implementados — asume que **no** están implementados (overview.md §6/§8, más detallado, con deuda técnica AT-00x registrada) salvo que el código demuestre lo contrario.
