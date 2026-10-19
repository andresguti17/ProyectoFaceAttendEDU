# Informe de procesos ISO/IEC 29110 (perfil Basic) — FaceAttend-Edu Back-end

> Instrumento de valoración integrado como CRUD en `09-ms-quality` y trazabilidad con las
> evaluaciones ISO 25010 ya existentes.

## 1. Qué se validó
Se aplicó el instrumento de 20 objetivos (escala N/P/L/F por objetivo) del nuevo módulo
`GET /api/v1/quality/process/profile` sobre la forma de trabajo del backend, cubriendo los 2
procesos del perfil Basic para entidades muy pequeñas (VSE): Gestión de Proyecto (PM, 8 objetivos
PM.O1–O8) e Implementación de Software (SI, 12 objetivos SI.O1–SI.O12), más 11 productos de
trabajo (WP1–WP11).

Hallazgos principales (antes de intervenir):

| # | Proceso / Actividad 29110 | Hallazgo en el backend actual | Severidad |
|---|---------------------------|-------------------------------|-----------|
| 1 | PM.1 Planificación | No existía registro de proyecto (alcance, cliente, fechas, estado) ligado a las evaluaciones de calidad | Alta |
| 2 | PM.3 Evaluación y control | Sin medición de avance por proceso: las evaluaciones 25010 medían producto pero no madurez del proceso | Alta |
| 3 | PM.4 Cierre | Sin criterio objetivo de preparación para entrega (qué significa "listo") | Media |
| 4 | SI.2 Análisis | Sin matriz de trazabilidad requerimientos↔diseño↔pruebas; evaluaciones de producto huérfanas | Alta |
| 5 | SI.5 Integración y pruebas | Sin registro de valoraciones de proceso con evidencias por objetivo | Media |
| 6 | SI.6 Entrega | El servicio de calidad no exponía perfil, objetivos ni productos de trabajo consultables | Media |

## 2. Qué se agregó (integración al CRUD)
**Módulo 29110 en `09-ms-quality` (puerto 8089, sin cambios en gateway: vive bajo `/api/v1/quality`):**
- `GET /api/v1/quality/process/profile` — instrumento: procesos PM/SI, 20 objetivos con evidencia esperada, 11 productos, escala N/P/L/F y regla de entrega.
- `POST /api/v1/quality/projects` — crea proyecto (201): nombre, cliente, fechas, estado Planned/Active/Closed.
- `GET /api/v1/quality/projects?status=&limit=&offset=` — listado paginado (máx 100).
- `GET /:id`, `PUT /:id`, `DELETE /:id` (soft-delete, 204) de proyectos.
- `POST /api/v1/quality/assessments` — crea valoración de proceso (201; valida `projectId` existente, `processId` PM/SI y exige todos los objetivos del proceso con valores N/P/L/F).
- `GET /api/v1/quality/assessments?projectId=&processId=&limit=&offset=`, detalle, actualización con recálculo y soft-delete.
- `GET /api/v1/quality/projects/:id/summary` — puntaje por proceso, global y preparación para entrega.
- **Trazabilidad SI.O2:** las evaluaciones ISO 25010 aceptan ahora `projectId` opcional, ligando calidad de producto con proyecto/proceso (retrocompatible: payloads anteriores siguen válidos).

**Modelo de puntaje:** cada objetivo N/P/L/F vale 0/1/2/3; % del proceso sobre el máximo;
calificación N ≤15%, P ≤50%, L ≤85%, F >85% (umbrales adaptados de ISO/IEC 33020);
global = promedio PM–SI; entrega lista solo si PM y SI superan el 50%.

## 3. Resultados tras aplicar el instrumento
Valoración de verificación con el propio instrumento (proyecto "FaceAttend-Edu", asesor `qa-lead`,
todos los objetivos en L):

| Proceso | Objetivos | Puntaje | Calificación |
|---------|-----------|---------|--------------|
| PM Gestión de Proyecto | 8/8 en L | 66.7% | L (Largamente alcanzado) |
| SI Implementación de Software | 12/12 en L | 66.7% | L (Largamente alcanzado) |
| **Global proyecto** | 20/20 | **66.7%** | **Listo para entrega** |

Verificado por ejecución:
- `npm run build` OK; `GET /process/profile → 20 objetivos`;
- `POST /projects → 201 {projectId 1, Active}`;
- `POST /assessments PM → 201 {score 66.7, rating L}`; `SI → {score 66.7, rating L}`;
- `GET /projects/1/summary → {globalScore 66.7, ready true, "Listo para entrega"}`;
- Casos negativos: `projectId` inexistente → 400, calificación inválida → 400, objetivos incompletos → 400.

Efecto por proceso: PM.1/PM.4 (proyectos registrados con ciclo de vida), PM.3 (medición y control por puntaje), PM.4 (criterio de entrega objetivo), SI.2 (trazabilidad producto↔proyecto), SI.5/SI.6 (evidencias y perfil consultable).

## 4. Cómo usar el instrumento desde ahora
```bash
# 1) Ver el instrumento
curl http://localhost:8089/api/v1/quality/process/profile
# 2) Crear proyecto y valorar PM + SI (N/P/L/F por objetivo)
curl -X POST http://localhost:8089/api/v1/quality/projects -H "Content-Type: application/json" -d "{...}"
curl -X POST http://localhost:8089/api/v1/quality/assessments -H "Content-Type: application/json" -d "{...}"
# 3) Ver resumen y preparación para entrega
curl http://localhost:8089/api/v1/quality/projects/1/summary
# Vía gateway: http://localhost:8080/api/v1/quality/process/... y /projects/... y /assessments/...
```
Recomendación: valorar PM y SI al cierre de cada iteración, ligar cada evaluación 25010 a su
`projectId` y exigir ambos procesos en L (>50%) antes de declarar una entrega.
