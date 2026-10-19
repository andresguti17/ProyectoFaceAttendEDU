---
name: faceattend-biometric-service
description: Use when implementing or modifying facial/fingerprint recognition logic, embeddings, or liveness checks inside back-end/06-ms-biometric (FastAPI, Python 3.12), or when wiring frontend biometric capture to its endpoints.
---

# Servicio de biometría (06-ms-biometric)

## Overview
`06-ms-biometric` (Python 3.12 + FastAPI, puerto 8086) es el único servicio que calcula y compara biometría (rostro + huella) en FaceAttend-EDU. Nació de fusionar el antiguo `10-ms-face-auth` (hoy carpeta vacía con solo `.pytest_cache/`, sin código — no reactivarla). Usa PostgreSQL vacío/no-core y MongoDB para los embeddings (`facial_embeddings`, `fingerprint_embeddings`; dueño lógico documentado en AGENTS.md §4.6/§1).

## Cuándo usar esta skill
- Vas a tocar `back-end/06-ms-biometric/domain/*.py` (`face_encoding.py`, `fingerprint_decode.py`, `fingerprint_matching.py`, `similarity.py`, `policies.py`) o sus puertos/adaptadores.
- Vas a exponer un endpoint `/facial/*` o `/fingerprint/*` consumido por `Mobile/src/services/FaceAuthService.js` o `Web/src/viewmodels/useFaceCapture.js`.
- Vas a tocar liveness (retos de parpadeo/giro/boca) o umbrales de similitud coseno/matching.

## Convenciones verificadas
- Arquitectura hexagonal: `domain/entities`, `domain/ports/{in_,out}` → `infrastructure/web/routers` (entrada), persistencia Mongo en `infrastructure/persistence`.
- Librerías reales (`pyproject.toml`): `face-recognition` (dlib-backed) para rostro; `opencv-python-headless` para huella (matching de keypoints); `motor`/`pymongo` para Mongo. Dos pines documentados en el propio `pyproject.toml`: dependencia git de `face-recognition-models` y `setuptools<81` (por `pkg_resources`) — no los quites sin motivo.
- `Dockerfile` multi-stage: builder `python:3.12-slim` con Poetry → runtime `python:3.12-slim` copiando `.venv`, usuario no-root, `EXPOSE 8086`, `CMD uvicorn main:app`.
- `biometric_type` ENUM `FACIAL|FINGERPRINT`; `finger_number` solo 1..10 si es FINGERPRINT, NULL si FACIAL (regla ya normativa en AGENTS.md §6.10 — no la reinterpretes aquí).

## Guía
1. Antes de editar, verifica si el código vivo está en `06-ms-biometric/domain/...` o en `06-ms-biometric/face_auth/domain/...` — **existen ambos árboles duplicados** (residuo de la fusión con `10-ms-face-auth`) y no está confirmado cuál importa realmente `main.py`. Haz `grep` de los imports en `main.py`/routers antes de decidir dónde editar.
2. Sigue el patrón puertos/adaptadores existente: lógica pura (encoding, matching, similitud) en `domain/`, sin importar FastAPI ni Mongo directamente ahí.
3. Para nuevos endpoints de liveness, replica el patrón de retos aleatorios ya usado por el frontend (`Web/src/viewmodels/useFaceCapture.js`: 6 fotogramas por gesto) en vez de inventar un protocolo nuevo.
4. Cambios de esquema Mongo (nuevos campos en `facial_embeddings`/`fingerprint_embeddings`) no llevan Liquibase — no hay migraciones para Mongo en este proyecto.

## Restricciones
- **Dato biométrico = dato sensible** (Ley 1581/2012 Habeas Data Colombia + principios GDPR, `fae-docs/04-requirements/non-functional.md` NFR-004, `fae-docs/02-domain` RN-27..29): nunca loguear embeddings, imágenes crudas ni plantillas de huella; preferir siempre embeddings sobre imágenes crudas al persistir. No devolver datos biométricos crudos en ninguna respuesta de API ni mostrarlos en UI.
- No reactivar ni mover código a `back-end/10-ms-face-auth` (vacío y fusionado); tampoco a la carpeta vacía anómala `back-end/06-ms-biometric;C` (origen no verificado, probablemente artefacto de filesystem).
- No cambies el modelo relacional de `biometric_update_case` sin seguir AGENTS.md (DBML primero).

## Verificación
```bash
cd back-end/06-ms-biometric
poetry install --no-root
poetry run pytest
```
Es exactamente lo que ejecuta el job `python-services` de `.github/workflows/ci.yml` (incluye deps de sistema `build-essential cmake pkg-config libopenblas-dev liblapack-dev` para compilar dlib si corres fuera de Docker). `bandit -r . -x ./tests,./.venv` corre informativo en CI (no bloqueante).

## Dudas/pendientes
- No está verificado cuál de los dos árboles (`domain/` raíz vs `face_auth/domain/`) es el que usa `main.py` en producción.
- No se confirmó en código el nombre exacto de las colecciones Mongo (se infiere de `SERVICES.md`: `facial_embeddings`, `fingerprint_embeddings`).
- `testcontainers[mongodb]` está declarado como dev-dependency pero no se confirmó que algún test lo invoque realmente.
