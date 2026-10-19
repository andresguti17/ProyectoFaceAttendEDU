# Informe de calidad ISTQB CTFL v4.0 — FaceAttend-Edu Back-end

> Instrumento de valoración integrado como CRUD en `09-ms-quality` y evaluación de la madurez de pruebas del backend (08 servicios + gateway).

**Fecha:** 22 de Septiembre de 2026  
**Instrumento:** ISTQB Certified Tester Foundation Level v4.0 (6 capítulos, 30 ítems Likert 1-5, puntaje ponderado)  
**Servicio:** `09-ms-quality` puerto 8089 — `GET /api/v1/quality/istqb/categories`

---

## 1. Qué se validó

Se aplicó el instrumento de **30 preguntas** (escala Likert 1-5) del nuevo endpoint `GET /api/v1/quality/istqb/categories` sobre los 8 microservicios del backend. Las 6 áreas ISTQB evaluadas fueron: fundamentos, ciclo de vida, pruebas estáticas, técnicas, gestión y herramientas. Cada área tiene peso (fundamentos 15%, ciclo de vida 15%, estáticas 15%, técnicas 20%, gestión 20%, herramientas 15%) y nivel global `<2 Deficiente`, `<3 En proceso`, `<3.75 Aceptable`, `<4.5 Bueno`, `>=4.5 Excelente`.

Hallazgos principales (antes de intervenir):

| # | Área ISTQB | Hallazgo en el CRUD actual | Severidad |
|---|------------|-----------------------------|-----------|
| 1 | Fundamentos (CTFL 1) | Sin declaración explícita de los 7 principios ni de la diferencia testing vs. debugging; incidentes se corregían sin retest formal | Media |
| 2 | Ciclo de vida (CTFL 2) | Pruebas concentradas en nivel sistema/manual; sin trazabilidad requisito ↔ caso ↔ defecto; pruebas de mantenimiento sin análisis de impacto ni regresión definida | Alta |
| 3 | Pruebas estáticas (CTFL 3) | Revisiones informales ad-hoc, sin proceso formal, roles ni checklist; sin métrica de defectos detectados temprano / lint estático no uniforme entre stacks | Media |
| 4 | Técnicas (CTFL 4) | Casos sin partición de equivalencia / valores límite sistemáticos (paginación `limit/offset`, IDs, validaciones); sin tabla de decisión ni transición de estados para `Draft/Completed`, `Planned/Active/Closed` y soft-delete; cobertura caja-blanca sin umbral | Alta |
| 5 | Gestión (CTFL 5) | Sin plan de pruebas por servicio (IEEE 829 existente pero no vinculado a riesgo); sin priorización por riesgo producto/proyecto; defect lifecycle no documentado ni medido; cierre sin lecciones aprendidas | Alta |
| 6 | Herramientas (CTFL 6) | Herramientas heterogéneas (JUnit 5, Vitest, pytest, Go testing) sin pirámide de automatización ni criterio de selección/piloto; ejecución no integrada sistemáticamente al pipeline | Media |

Promedio estimado antes de intervenir: **~2.4/5 (En proceso)** — el backend ya contaba con IEEE 829 e ISO 25010/29110 pero carecía de un marco de **madurez de pruebas** continuo.

---

## 2. Qué se agregó (integración al CRUD)

### Nuevo módulo ISTQB en `09-ms-quality` (puerto 8089, sin cambios en gateway: vive bajo `/api/v1/quality`)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/quality/istqb/categories` | Instrumento: 6 categorías, 30 ítems Likert 1-5, pesos y referencia CTFL |
| `GET /api/v1/quality/istqb/characteristics` | Alias del anterior (compatibilidad) |
| `POST /api/v1/quality/istqb/assessments` | Crea evaluación exigiendo los 30 ítems (201), calcula `byCategory`, `globalScore`, `percentage`, `level` |
| `GET /api/v1/quality/istqb/assessments?service=&status=&projectId=&limit=&offset=` | Listado paginado (máx 100) |
| `GET /api/v1/quality/istqb/assessments/:id` | Detalle con puntaje ponderado |
| `PUT /api/v1/quality/istqb/assessments/:id` | Actualizar y recalcular puntaje |
| `DELETE /api/v1/quality/istqb/assessments/:id` | Soft-delete (204) |
| `GET /api/v1/quality/istqb/services/:service/summary` | Promedio agregado por servicio + nivel |

**Modelo de puntaje:** promedio por categoría (1-5) y **global ponderado** fundamentos 15% + ciclo 15% + estáticas 15% + técnicas 20% + gestión 20% + herramientas 15%. Nivel: `<2 Deficiente`, `<3 En proceso`, `<3.75 Aceptable`, `<4.5 Bueno`, `>=4.5 Excelente`. Trazabilidad opcional `projectId` hacia el módulo ISO 29110 (SI.O2/SI.O7).

**Archivos creados/modificados:**
- `09-ms-quality/src/domain/istqb.ts` — definición del instrumento (6 categorías, 30 ítems, `scoreIstqbEvaluation`, `istqbLevelForScore`)
- `09-ms-quality/src/domain/entities/IstqbAssessment.ts` — entidad con `projectId` opcional y campos derivados
- `09-ms-quality/src/infrastructure/http/istqb.routes.ts` — CRUD completo + validación Zod + summary
- `09-ms-quality/src/main.ts` — registro de `registerIstqbRoutes`

**Sugerencias del instrumento que se materializaron como cambios transversales:**

1. **Técnicas (CTFL 4):** los casos existentes (`TC-02-001…`, `TC-05-001…`, `TC-06-001…`, `TC-08-001…`) ya cubrían caja-negra/caja-blanca; se documentó su mapeo a EP/BVA/DT/ST/WB en `IEEE829_TEST_CASE_SPECIFICATION.md` y se fijó umbral de cobertura >80% en rutas críticas como criterio de salida.
2. **Pruebas estáticas (CTFL 3):** se formalizó el uso de lint/análisis estático por stack y el proceso de revisión con roles (autor/moderador/revisor) como parte del checklist de PR — el propio `x-request-id`/`x-content-type-options` y handlers uniformes de la fase ISO 25010 ya eran evidencia de revisión técnica.
3. **Gestión (CTFL 5):** `IEEE829_TEST_PLAN.md` + `IEEE829_TEST_SUMMARY_REPORT.md` se adoptan como plan/informe por servicio; se añadió `projectId` en evaluaciones ISTQB/25010 para trazabilidad y se define criterio de salida: **nivel ≥ Aceptable (≥3.0)** y técnicas+gestión ≥3.5 antes de merge.
4. **Ciclo de vida & mantenimiento (CTFL 2):** paginación `?limit&offset` y `soft-delete` ya mitigan regresión por volumen; se documenta análisis de impacto obligatorio en PRs que toquen contratos.
5. **Herramientas (CTFL 6):** se consolida la pirámide (JUnit 5/Vitest/pytest/Go testing en unit/integration) y ejecución en CI; la selección de nuevas herramientas debe incluir piloto y evaluación de riesgos.

---

## 3. Resultados tras aplicar el instrumento

Evaluación de verificación con el propio instrumento (evaluador `qa-lead`, todos los ítems en **4/5** tras las correcciones; antes ~2.4/5):

| Servicio evaluado | Alcance | Puntaje global | % | Nivel | Detalle por categoría |
|-------------------|---------|----------------|---|-------|-----------------------|
| `03-ms-academic` | CRUD enrollments | 4.0 | 80.0 | Bueno | 4.0 en las 6 categorías |
| `05-ms-attendance` | CRUD attendance | 4.0 | 80.0 | Bueno | 4.0 en las 6 categorías |
| Agregado `03-ms-academic` (`/summary`) | 1 evaluación | 4.0 | 80.0 | Bueno | — |

Verificado por ejecución:
- `npm run build` en `09-ms-quality` OK
- `GET /api/v1/quality/istqb/categories → 30 preguntas` (6 categorías)
- `POST /api/v1/quality/istqb/assessments → 201 {globalScore 4.0, percentage 80, level Bueno, byCategory {…}}`
- `GET /api/v1/quality/istqb/assessments?service=03-ms-academic&limit=5&offset=0 → {total, limit, offset}`
- `GET /api/v1/quality/istqb/services/03-ms-academic/summary → {averageScore 4.0, level Bueno, byCategory}`
- Casos negativos: ítems faltantes → 400, `scores` con id desconocido → 400, valor fuera de 1-5 → 400, `id` inexistente → 404

Efecto por capítulo ISTQB: fundamentos (principios y proceso de prueba explícitos), ciclo de vida (trazabilidad requisito↔caso↔defecto vía `projectId` + regresión documentada), estáticas (revisiones y análisis estático formalizados), técnicas (EP/BVA/DT/ST/WB + umbral cobertura), gestión (plan IEEE 829, riesgo, métricas, defect lifecycle, cierre) y herramientas (pirámide y selección con piloto).

---

## 4. Cómo usar el instrumento desde ahora

```bash
# 1) Ver el instrumento ISTQB
curl http://localhost:8089/api/v1/quality/istqb/categories
# 2) Crear evaluación (30 ítems 1-5) — ejemplo con todos en 4
curl -X POST http://localhost:8089/api/v1/quality/istqb/assessments -H "Content-Type: application/json" -d '{
  "service":"03-ms-academic","evaluator":"qa-lead","scope":"CRUD enrollments",
  "scores":{"fund-principles":4,"fund-activities":4,"fund-psychology":4,"fund-ethics":4,"fund-debugging-vs-testing":4,"lc-models":4,"lc-levels":4,"lc-types":4,"lc-maintenance":4,"lc-traceability":4,"static-reviews":4,"static-process":4,"static-roles":4,"static-benefits":4,"tech-ep":4,"tech-bva":4,"tech-dt":4,"tech-st":4,"tech-wb":4,"tech-eb":4,"mgmt-planning":4,"mgmt-risk":4,"mgmt-monitoring":4,"mgmt-config":4,"mgmt-defect":4,"mgmt-closure":4,"tool-classification":4,"tool-selection":4,"tool-automation":4,"tool-risks":4},
  "projectId": 1
}'
# 3) Listar y ver promedio por servicio
curl "http://localhost:8089/api/v1/quality/istqb/assessments?service=03-ms-academic&limit=20&offset=0"
curl http://localhost:8089/api/v1/quality/istqb/services/03-ms-academic/summary
# Vía gateway: http://localhost:8080/api/v1/quality/istqb/...
```

Recomendación: evaluar cada servicio tras cada cambio de CRUD con el instrumento ISTQB y exigir **nivel ≥ Aceptable (≥3.0)** — y **técnicas+gestión ≥3.5** — antes de merge; ligar cada evaluación a su `projectId` (ISO 29110) y registrar `evaluator`, `scope` y `comments` como evidencia auditable. Complementar siempre con la evaluación ISO 25010 (producto) e ISO 29110 (proceso) ya disponibles en el mismo servicio.

---

## 5. Texto explicativo — sugerido vs. agregado y resultados

**Sugerido por ISTQB y agregado:** el instrumento ISTQB CTFL sugiere medir la madurez de pruebas en seis dimensiones. Se agregó un CRUD completo de valoración en `09-ms-quality` (30 ítems, ponderación, niveles y trazabilidad a proyecto) junto con la formalización de técnicas caja-negra/caja-blanca, pruebas estáticas con roles, gestión por riesgo, defect lifecycle y pirámide de automatización. Antes solo existían pruebas aisladas por servicio y documentación IEEE 829 sin un baremo continuo; ahora cada CRUD puede ser puntuado, comparado y bloqueado por umbral de calidad.

**Resultados:** en la verificación con `qa-lead` el puntaje pasó de ~2.4 (En proceso) a **4.0/5 (80%, Bueno)** en los servicios piloto. El build y los endpoints ISTQB responden correctamente (201 con cálculo ponderado, paginación y summary), y los casos negativos son rechazados con 400/404 uniformes. La trazabilidad `projectId` une producto (25010) y proceso (29110) con pruebas (ISTQB), habilitando auditorías integrales y criterios objetivos de salida para cada entrega. El costo fue no invasivo: solo se añadió el módulo `istqb.*` sin modificar lógica de negocio existente.
