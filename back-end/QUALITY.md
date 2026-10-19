# ISO/IEC 9001 — Plan de Calidad para FaceAttend-Edu Backend

## 1. Alcance

Este documento define la aplicación del **instrumento de valoración ISO/IEC 9001:2015** al backend polyglot de FaceAttend-Edu, cubriendo los 8 microservicios y el API Gateway.

---

## 2. Requisitos de ISO/IEC 9001 Aplicados al Software

### 2.1 Cláusula 8.2 — Requisitos para productos y servicios
| Criterio ISO | Implementación en CRUD | Estado |
|---|---|---|
| Validación de entrada | DTOs + schema validation en cada endpoint (Zod/JSR-380/Pydantic/binding) | ✅ Implementado |
| Definición de requisitos | OpenAPI specs por servicio + documentación en SERVICE.md | ✅ Implementado |
| Comunicación con el cliente | Respuestas HTTP estandarizadas con códigos de error estructurados | 🆕 Integrado |

### 2.2 Cláusula 8.5 — Producción y prestación de servicios
| Criterio ISO | Implementación en CRUD | Estado |
|---|---|---|
| Control de producción | Validación de dominio en entidades (`validate()`) | ✅ Existente |
| Identificación y trazabilidad | Audit fields: `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `row_version` | ✅ Existente |
| Propiedad de outputs | Soft delete con `deleted_at` + `row_version` para concurrencia | ✅ Existente |
| **Auditoría de operaciones CRUD** | 🆕 Quality Audit Logger — registro de cada operación con metadata completa | 🆕 Integrado |
| **Control de cambios** | 🆕 Quality Change Tracker — cada update registra diff de campos modificados | 🆕 Integrado |

### 2.3 Cláusula 9.1 — Seguimiento, medición, análisis y evaluación
| Criterio ISO | Implementación en CRUD | Estado |
|---|---|---|
| **Métricas de operación** | 🆕 Quality Metrics Collector — contadores de Create/Read/Update/Delete por entidad | 🆕 Integrado |
| **Tasa de error** | 🆕 Error Rate Tracker — clasificación de errores por tipo y endpoint | 🆕 Integrado |
| **Tiempo de respuesta** | 🆕 Response Time Monitor — latencia por operación CRUD | 🆕 Integrado |
| **Health check mejorado** | 🆕 `/health/quality` — endpoint con métricas de calidad consolidadas | 🆕 Integrado |

### 2.4 Cláusula 10.2 — No conformidad y acción correctiva
| Criterio ISO | Implementación en CRUD | Estado |
|---|---|---|
| Identificación de no conformidades | 🆕 Quality Error Classifier — clasificación automática de errores | 🆕 Integrado |
| Acción correctiva | 🆕 Error correlation IDs para trazabilidad de incidents | 🆕 Integrado |
| **Respuesta estructurada de error** | 🆕 Formato estándar: `{ error: { code, message, correlationId, timestamp, path } }` | 🆕 Integrado |

### 2.5 Cláusula 7.5 — Información documentada
| Criterio ISO | Implementación en CRUD | Estado |
|---|---|---|
| **Log de auditoría** | 🆕 Quality Audit Log — cada operación CRUD genera un registro persistente | 🆕 Integrado |
| **Reporte de calidad** | 🆕 `/api/v1/quality/report` — resumen ejecutivo de salud del sistema | 🆕 Integrado |

---

## 3. Arquitectura de Calidad Implementada

### 3.1 Componentes por Stack Tecnológico

```
back-end/
├── quality/                          ← Módulo compartido de documentación
│   ├── QUALITY.md                    ← Este documento
│   ├── quality-spec.yaml             ← Especificación OpenAPI de endpoints de calidad
│   └── quality-codes.md              ← Catálogo de códigos de error ISO 9001
│
├── 01-ms-identity/                   ← Java Spring Boot
│   └── ...QualityAuditInterceptor    ← Interceptor AOP de auditoría
│
├── 02-ms-authorization/              ← Java Spring Boot
│   └── ...QualityAuditInterceptor    ← Interceptor AOP de auditoría
│
├── 03-ms-academic/                   ← TypeScript Fastify
│   └── qualityMiddleware.ts          ← Middleware Fastify de calidad
│
├── 04-ms-scheduling/                 ← Java Spring Boot
│   └── ...QualityAuditInterceptor    ← Interceptor AOP de auditoría
│
├── 05-ms-attendance/                 ← Java Spring Boot
│   └── ...QualityAuditInterceptor    ← Interceptor AOP de auditoría
│
├── 06-ms-biometric/                  ← Python FastAPI
│   └── quality_middleware.py         ← Middleware FastAPI de calidad
│
├── 07-ms-configuration/              ← TypeScript Fastify
│   └── qualityMiddleware.ts          ← Middleware Fastify de calidad
│
├── 08-ms-notification/               ← Go Gin
│   └── quality_middleware.go         ← Middleware Gin de calidad
│
└── 99-api-gateway/                   ← Kong
    └── kong.yml                      ← Plugin de calidad en gateway
```

### 3.2 Flujo de una operación CRUD con calidad ISO 9001

```
Request → [Quality Middleware] → [Auth] → [Controller] → [UseCase] → [Repository] → Response
              │                                         │
              ├── 1. Generate correlationId             ├── 6. Log operation result
              ├── 2. Validate request schema            ├── 7. Record metrics
              ├── 3. Start timer                        └── 8. Classify errors
              ├── 4. Log incoming request
              └── 5. Attach to context
```

---

## 4. Códigos de Error ISO 9001

| Código | Significado | Cláusula ISO | HTTP Status |
|---|---|---|---|
| `ISO-8.2-VAL` | Error de validación de entrada | 8.2 Requisitos | 400 |
| `ISO-8.5-AUTH` | Error de autenticación/autorización | 8.5 Producción | 401/403 |
| `ISO-8.5-INT` | Error interno del proceso | 8.5 Producción | 500 |
| `ISO-8.5-DUP` | Detección de duplicidad/conflicto | 8.5 Producción | 409 |
| `ISO-9.1-MET` | Error en métricas/seguimiento | 9.1 Medición | 500 |
| `ISO-10.2-NC` | No conformidad detectada | 10.2 Acción correctiva | 500 |
| `ISO-7.5-INF` | Error en información documentada | 7.5 Documentación | 500 |
| `ISO-4.4-PRC` | Error en proceso del sistema | 4.4 Contexto | 503 |

---

## 5. Resultados Esperados tras la Implementación

### 5.1 Antes de la Integración
- Errores genéricos sin clasificación (`{ error: "string" }`)
- Sin trazabilidad de operaciones CRUD
- Sin métricas de rendimiento por operación
- Sin correlación entre errores
- Health check básico solo con estado OK

### 5.2 Después de la Integración
- **Trazabilidad completa**: Cada operación CRUD genera un registro con: correlationId, timestamp, usuario, operación, entidad, resultado, duración
- **Clasificación de errores**: Errores categorizados bajo cláusulas ISO para facilitar auditorías
- **Métricas en tiempo real**: Contadores de operaciones CRUD, tasas de error, tiempos de respuesta
- **Health check de calidad**: Endpoint que reporta la salud del sistema con indicadores KPI
- **Cumplimiento normativo**: Cada operación es auditable bajo los criterios ISO/IEC 9001

---

## 6. Métricas de Calidad (KPIs)

| KPI | Fórmula | Meta |
|---|---|---|
| Disponibilidad | `(uptime_minutes / total_minutes) * 100` | ≥ 99.5% |
| Tasa de éxito CRUD | `(successful_ops / total_ops) * 100` | ≥ 99% |
| Tiempo respuesta P95 | `percentile(95, response_times)` | ≤ 200ms |
| Tasa de error 5xx | `(server_errors / total_requests) * 100` | ≤ 0.1% |
| Cobertura de validación | `(validated_inputs / total_inputs) * 100` | 100% |
| Tasa de audit coverage | `(audited_ops / total_ops) * 100` | 100% |

---

## 7. IEEE 829 — Documentación de Pruebas

### 7.1 Integración del Estándar IEEE 829

Se ha integrado el estándar **IEEE 829-1998** para documentación de pruebas de software, complementando la infraestructura de calidad ISO 9001.

| Documento IEEE 829 | Archivo | Estado |
|---|---|---|
| Test Plan | `IEEE829_TEST_PLAN.md` | ✅ Implementado |
| Test Case Specification | `IEEE829_TEST_CASE_SPECIFICATION.md` | ✅ Implementado |
| Test Summary Report | `IEEE829_TEST_SUMMARY_REPORT.md` | ✅ Implementado |
| Test Incident Report | `IEEE829_TEST_INCIDENT_REPORT.md` | ✅ Implementado |
| Test Log Middleware | `ieee829TestLogMiddleware.ts` | 🆕 Integrado |

### 7.2 Archivos de Prueba por Servicio

| Servicio | Archivo de Prueba | Tipo | Test Cases |
|---|---|---|---|
| 02-ms-authorization | `RoleControllerTest.java` | JUnit 5 | TC-02-001 a TC-02-006 |
| 03-ms-academic | `academic.test.ts` | Vitest | TC-03-001 a TC-03-010 |
| 05-ms-attendance | `AttendanceRecordControllerTest.java` | JUnit 5 | TC-05-001 a TC-05-006 |
| 06-ms-biometric | `test_facial_embedding.py` | pytest | TC-06-001 a TC-06-008 |
| 08-ms-notification | `alert_handler_test.go` | Go testing | TC-08-001 a TC-08-010 |

### 7.3 Endpoints de Prueba (IEEE 829 Test Log)

| Endpoint | Descripción |
|---|---|
| `GET /api/v1/quality/test-log` | Obtener registros de prueba |
| `GET /api/v1/quality/test-log/:testId` | Obtener registro específico |
| `GET /api/v1/quality/test-summary` | Reporte resumido de pruebas |

---

## 8. Nota de Implementación

Este plan se implementa de forma **no invasiva**: los middlewares/interceptores se agregan sin modificar la lógica de negocio existente. Cada servicio mantiene su independencia y se beneficia de las mejoras de calidad de forma transparente.
