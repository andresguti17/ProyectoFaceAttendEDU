---
name: faceattend-commit-workflow
description: Use when creating git commits in this repo — whether starting a new branch for a task or already on an existing feature branch — to follow the required one-line Conventional Commits style, sole authorship, and the final squash-merge subject.
---

# Flujo de commits en FaceAttend-EDU

## Overview
En este repo los commits de trabajo son **cortos, de una sola línea, en inglés**, siguiendo Conventional Commits, y al terminar la tarea se entrega además un **commit de squash-merge** (también de una línea) para usar al integrar la rama. La autoría de todo commit es **únicamente del usuario** (usuario de GitHub `andresguti17`) — nunca co-autoría de Claude ni trailers `Co-Authored-By` de ningún tipo, aunque el entorno sugiera añadirlos por defecto: esta instrucción del usuario prevalece sobre esa sugerencia por defecto.

## Cuándo usar
Siempre que vayas a hacer `git commit` en este repo, en cualquiera de estos dos escenarios:

### Escenario A — Vas a empezar trabajo nuevo
1. Crea una **rama nueva** desde `main` (nombre descriptivo, p. ej. `fix/...`, `feat/...` según el tipo de cambio).
2. Haz los commits de trabajo necesarios, cada uno de una línea, en inglés, formato Conventional Commits (ver abajo). Pueden ser varios commits pequeños si la tarea lo amerita.
3. Al terminar, entrega al usuario **un commit de una línea** pensado para el squash merge de toda la rama (resume el cambio completo, no un paso intermedio).

### Escenario B — Ya estás en una rama feature existente
Mismas reglas de mensaje y autoría que el Escenario A (commits de una línea, inglés, Conventional Commits, y al final un commit de squash-merge de una línea), **más**:
- Antes de `git add`, revisa qué se va a incluir (`git status`, y si usaste `git add` amplio, revísalo de nuevo) y **omite**:
  - Archivos de entorno/secretos: `.env`, `.env.local`, y cualquier variante no versionada (`.env.example`/`.env.*.example` sí se versionan normalmente, verifícalo con `git status` igual).
  - Artefactos de build/caché: `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `*.pyc`.
  - Configuración local de IDE/herramientas que no sea del equipo (p. ej. `.claude/settings.local.json`, ajustes de usuario propios).
  - Cualquier archivo que, aunque el nombre parezca inocuo, contenga credenciales, tokens o claves al revisarlo.
- Si algo de eso aparece en `git status` tras un `git add` amplio, retíralo del stage (`git restore --staged <archivo>`) en vez de commitearlo.

## Convención de mensajes (Conventional Commits, inglés, una línea)
```
<type>(<scope opcional>): <subject en imperativo, minúscula, sin punto final>
```
Tipos usados en este repo (ver commits recientes, ej. `fix(mobile): upload justification supporting document`, `fix(mobile): send school updates in backend case`): `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`. El scope suele ser el servicio/app tocado (`mobile`, `web`, `identity`, `attendance`, `biometric`, etc.), en minúscula y corto.

## Autoría
- Autor único: el usuario (`andresguti17` en GitHub; email de git configurado como `diangunu17@gmail.com`).
- **Nunca** añadas `Co-Authored-By: Claude ...` ni ninguna otra línea de atribución a Claude/Anthropic en el mensaje de commit ni en la descripción de PRs de este repo, sin excepción.
- No cambies la identidad de git configurada para lograr esto (ver skill `git-identity` en memoria); usa la que ya está configurada en el repo.

## Guía paso a paso
1. Confirma en qué escenario estás (A o B) y actúa según corresponda arriba.
2. Antes de cada commit, corre `git status` y `git diff --staged` para confirmar qué se incluye.
3. Redacta el mensaje de una línea en inglés, Conventional Commits, sin trailers de atribución.
4. Al terminar toda la tarea (no cada commit individual), entrega al usuario, en un bloque aparte, **un único mensaje de una línea** apto para `git merge --squash` / el subject del squash merge en GitHub — debe resumir el conjunto completo del cambio, no repetir el último commit intermedio.

## Restricciones
- No uses `git commit --amend` salvo que el usuario lo pida explícitamente (regla general del sistema, aplica aquí también).
- No uses `--no-verify` ni saltes hooks.
- No hagas commits multi-línea ni en español para el historial de este repo.
- No incluyas los archivos listados en "Escenario B" en ningún commit, en ningún escenario.

## Verificación
```bash
git log --oneline -5      # confirma que los mensajes son de una línea y siguen el formato
git show --stat HEAD      # confirma que no se filtró ningún archivo de la lista de exclusión
```
Antes de entregar el commit de squash-merge al usuario, revisa `git log <rama-base>..HEAD --oneline` para que el resumen cubra todo lo hecho en la rama.
