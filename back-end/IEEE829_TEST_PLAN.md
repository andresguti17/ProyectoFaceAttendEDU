# IEEE 829 — Plan de Pruebas para FaceAttend-Edu Backend

## 1. Plan de Pruebas (Test Plan)

### 1.1 Identificación del Plan
| Campo | Valor |
|---|---|
| **Nombre del Plan** | FaceAttend-Edu Backend CRUD Test Plan |
| **Versión** | 1.0 |
| **Fecha** | 21 de Septiembre de 2026 |
| **Estándar** | IEEE 829-1998 |
| **Objetivo** | Validar la funcionalidad CRUD de todos los microservicios |

### 1.2 Alcance de Pruebas
| Microservicio | Stack | Puerto | Endpoints | Prioridad |
|---|---|---|---|---|
| 01-ms-identity | Java Spring Boot | 8081 | persons, users, auth, sessions, cities | Alta |
| 02-ms-authorization | Java Spring Boot | 8082 | roles, permissions, user-roles | Alta |
| 03-ms-academic | TypeScript Fastify | 8083 | schools, programs, periods, cohorts, courses, actors, enrollments | Alta |
| 04-ms-scheduling | Java Spring Boot | 8084 | environments, schedule-blocks, class-sessions | Media |
| 05-ms-attendance | Java Spring Boot | 8085 | attendance-records, justifications, justification-types, supporting-documents | Crítica |
| 06-ms-biometric | Python FastAPI | 8086 | facial, fingerprint embeddings | Media |
| 07-ms-configuration | TypeScript Fastify | 8087 | academic-config, security-config, biometric-update-cases | Baja |
| 08-ms-notification | Go Gin | 8088 | alert-types, alerts | Media |
| 99-api-gateway | Kong OSS | 8080 | Rutas aggregadas | Alta |

### 1.3 Tipos de Prueba
| Tipo | Descripción | Herramienta |
|---|---|---|
| **Unit Testing** | Pruebas de componentes individuales | JUnit 5, Vitest, pytest, Go testing |
| **Integration Testing** | Pruebas de integración entre capas | Spring Boot Test, Supertest, httpx |
| **API Testing** | Pruebas de endpoints REST | Newman/Postman, curl |
| **Performance Testing** | Pruebas de carga y rendimiento | k6, wrk |
| **Security Testing** | Pruebas de seguridad básicas | OWASP ZAP |

### 1.4 Criterios de Aceptación
| Criterio | Meta |
|---|---|
| Tasa de éxito de pruebas | ≥ 95% |
| Cobertura de código | ≥ 70% |
| Tiempo de respuesta P95 | ≤ 200ms |
| Tasa de error 5xx | ≤ 1% |
| Pruebas CRUD exitosas | 100% |

### 1.5 Riesgos y Mitigaciones
| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| DB no disponible | Media | Alto | Tests con H2/SQLite en memoria |
| Dependencias externas | Alta | Medio | Mocks y stubs |
| Concurrencia | Media | Alto | Tests de integración con DB real |

---

## 2. Diseño de Pruebas (Test Design)

### 2.1 Matriz de Pruebas CRUD por Entidad

| Servicio | Entidad | Create | Read | Update | Delete | List | Bulk |
|---|---|---|---|---|---|---|---|
| Identity | Person | TC-01-001 | TC-01-002 | TC-01-003 | TC-01-004 | TC-01-005 | — |
| Identity | City | TC-01-006 | TC-01-007 | TC-01-008 | TC-01-009 | TC-01-010 | — |
| Authorization | Role | TC-02-001 | TC-02-002 | TC-02-003 | TC-02-004 | TC-02-005 | — |
| Authorization | Permission | TC-02-006 | TC-02-007 | TC-02-008 | TC-02-009 | TC-02-010 | — |
| Academic | School | TC-03-001 | TC-03-002 | TC-03-003 | TC-03-004 | TC-03-005 | — |
| Academic | Program | TC-03-006 | TC-03-007 | TC-03-008 | TC-03-009 | TC-03-010 | — |
| Academic | Enrollment | TC-03-011 | TC-03-012 | TC-03-013 | TC-03-014 | TC-03-015 | — |
| Attendance | AttendanceRecord | TC-05-001 | TC-05-002 | TC-05-003 | TC-05-004 | TC-05-005 | TC-05-006 |
| Attendance | Justification | TC-05-007 | TC-05-008 | TC-05-009 | TC-05-010 | TC-05-011 | — |
| Notification | Alert | TC-08-001 | TC-08-002 | TC-08-003 | TC-08-004 | TC-08-005 | — |
| Notification | AlertType | TC-08-006 | TC-08-007 | TC-08-008 | TC-08-009 | TC-08-010 | — |

### 2.2 Pruebas de Validación por Campo

| Campo | Regla | Prueba Válida | Prueba Inválida |
|---|---|---|---|
| email | Formato email | `user@test.com` | `invalid-email` |
| attendanceStatus | Enum | `Present`, `Absent`, `Late`, `Justified` | `InvalidStatus` |
| captureMethod | Enum | `FACIAL`, `MANUAL`, `IOT`, `IMPORT` | `UNKNOWN` |
| matchScore | 0-1 | `0.85` | `1.5`, `-0.1` |
| code | No vacío | `SCH001` | `""` |
| name | No vacío | `School Name` | `""` |

---

## 3. Especificación de Casos de Prueba (Test Case Specification)

### 3.1 Casos de Prueba — Attendance Service (05-ms-attendance)

#### TC-05-001: Crear Registro de Asistencia
| Campo | Valor |
|---|---|
| **ID** | TC-05-001 |
| **Nombre** | Crear registro de asistencia válido |
| **Precondición** | Servicio activo, classSession y academicActor existen |
| **Pasos** | 1. POST /api/v1/attendance-records con payload válido |
| **Resultado Esperado** | 201 Created, body con attendanceRecordId |
| **Prioridad** | Alta |

#### TC-05-002: Obtener Registro de Asistencia
| Campo | Valor |
|---|---|
| **ID** | TC-05-002 |
| **Nombre** | Obtener registro por ID |
| **Precondición** | Registro TC-05-001 creado |
| **Pasos** | 1. GET /api/v1/attendance-records/{id} |
| **Resultado Esperado** | 200 OK, body con datos del registro |
| **Prioridad** | Alta |

#### TC-05-003: Actualizar Registro de Asistencia
| Campo | Valor |
|---|---|
| **ID** | TC-05-003 |
| **Nombre** | Actualizar estado de asistencia |
| **Precondición** | Registro TC-05-001 existe |
| **Pasos** | 1. PUT /api/v1/attendance-records/{id} con nuevo status |
| **Resultado Esperado** | 200 OK, body con attendanceStatus actualizado |
| **Prioridad** | Alta |

#### TC-05-004: Eliminar Registro de Asistencia
| Campo | Valor |
|---|---|
| **ID** | TC-05-004 |
| **Nombre** | Eliminar registro (soft delete) |
| **Precondición** | Registro TC-05-001 existe |
| **Pasos** | 1. DELETE /api/v1/attendance-records/{id} |
| **Resultado Esperado** | 204 No Content |
| **Prioridad** | Alta |

#### TC-05-005: Listar Registros de Asistencia
| Campo | Valor |
|---|---|
| **ID** | TC-05-005 |
| **Nombre** | Listar registros con filtros |
| **Precondición** | Al menos 1 registro existe |
| **Pasos** | 1. GET /api/v1/attendance-records?attendanceStatus=Present |
| **Resultado Esperado** | 200 OK, array de registros |
| **Prioridad** | Media |

#### TC-05-006: Crear Registros en Lote
| Campo | Valor |
|---|---|
| **ID** | TC-05-006 |
| **Nombre** | Bulk create de registros |
| **Precondición** | Servicio activo |
| **Pasos** | 1. POST /api/v1/attendance-records/bulk con array |
| **Resultado Esperado** | 201 Created, array de registros creados |
| **Prioridad** | Media |

### 3.2 Casos de Prueba — Notification Service (08-ms-notification)

#### TC-08-001: Crear Alerta
| Campo | Valor |
|---|---|
| **ID** | TC-08-001 |
| **Nombre** | Crear alerta válida |
| **Precondición** | AlertType existe |
| **Pasos** | 1. POST /api/v1/alerts con academic_actor_id y alert_type_id |
| **Resultado Esperado** | 201 Created |
| **Prioridad** | Alta |

#### TC-08-002: Resolver Alerta
| Campo | Valor |
|---|---|
| **ID** | TC-08-002 |
| **Nombre** | Marcar alerta como resuelta |
| **Precondición** | Alerta TC-08-001 existe |
| **Pasos** | 1. PUT /api/v1/alerts/{id}/resolve |
| **Resultado Esperado** | 200 OK, resolved_at no nulo |
| **Prioridad** | Alta |

### 3.3 Casos de Prueba — Academic Service (03-ms-academic)

#### TC-03-001: Crear Escuela
| Campo | Valor |
|---|---|
| **ID** | TC-03-001 |
| **Nombre** | Crear escuela con datos válidos |
| **Precondición** | Servicio activo |
| **Pasos** | 1. POST /api/v1/schools con code y name |
| **Resultado Esperado** | 201 Created, body con schoolId |
| **Prioridad** | Alta |

#### TC-03-002: Crear Programa
| Campo | Valor |
|---|---|
| **ID** | TC-03-002 |
| **Nombre** | Crear programa asociado a escuela |
| **Precondición** | Escuela TC-03-001 existe |
| **Pasos** | 1. POST /api/v1/programs con schoolId |
| **Resultado Esperado** | 201 Created, body con programId |
| **Prioridad** | Alta |

---

## 4. Procedimiento de Prueba (Test Procedure)

### 4.1 Procedimiento General
1. Verificar que el servicio está corriendo en el puerto asignado
2. Ejecutar pruebas unitarias del servicio
3. Ejecutar pruebas de integración
4. Ejecutar pruebas de API contra el servicio real
5. Registrar resultados en log de prueba
6. Generar reporte de incidencias si hay fallos

### 4.2 Ejecución por Servicio

#### Java Services (01, 02, 04, 05)
```bash
cd back-end/0X-ms-service
./mvnw test
./mvnw spring-boot:run &
# Esperar 30 segundos
curl -X POST http://localhost:808X/api/v1/...
./mvnw test:integration
```

#### TypeScript Services (03, 07)
```bash
cd back-end/0X-ms-service
npm install
npm test
npm run dev &
# Esperar 10 segundos
curl -X POST http://localhost:808X/api/v1/...
npm run test:integration
```

#### Python Service (06)
```bash
cd back-end/06-ms-biometric
pip install -r requirements.txt
pytest
uvicorn main:app --reload --port 8086 &
# Esperar 10 segundos
curl -X POST http://localhost:8086/api/v1/...
pytest --integration
```

#### Go Service (08)
```bash
cd back-end/08-ms-notification
go test ./...
go run cmd/server/main.go &
# Esperar 5 segundos
curl -X POST http://localhost:8088/api/v1/...
go test -integration ./...
```

---

## 5. Transmisión de Ítems de Prueba (Test Item Transmittal Report)

### 5.1 Ítems Entregados para Prueba
| Ítem | Versión | Ubicación | Estado |
|---|---|---|---|
| 01-ms-identity | 1.0 | back-end/01-ms-identity | Listo para pruebas |
| 02-ms-authorization | 1.0 | back-end/02-ms-authorization | Listo para pruebas |
| 03-ms-academic | 1.0 | back-end/03-ms-academic | Listo para pruebas |
| 04-ms-scheduling | 1.0 | back-end/04-ms-scheduling | Listo para pruebas |
| 05-ms-attendance | 1.0 | back-end/05-ms-attendance | Listo para pruebas |
| 06-ms-biometric | 1.0 | back-end/06-ms-biometric | Listo para pruebas |
| 07-ms-configuration | 1.0 | back-end/07-ms-configuration | Listo para pruebas |
| 08-ms-notification | 1.0 | back-end/08-ms-notification | Listo para pruebas |
| 99-api-gateway | 1.0 | back-end/99-api-gateway | Listo para pruebas |

---

## 6. Registro de Prueba (Test Log)

### 6.1 Formato del Log
```json
{
  "testId": "TC-05-001",
  "timestamp": "2026-09-21T10:30:00Z",
  "service": "05-ms-attendance",
  "endpoint": "POST /api/v1/attendance-records",
  "status": "PASS",
  "duration": 45,
  "response": 201,
  "assertions": ["statusCode == 201", "body.attendanceRecordId != null"]
}
```

---

## 7. Reporte de Incidencias (Test Incident Report)

### 7.1 Formato de Incidencia
```json
{
  "incidentId": "INC-001",
  "testId": "TC-05-001",
  "severity": "HIGH",
  "summary": "Create attendance record returns 500",
  "steps": "POST /api/v1/attendance-records with valid payload",
  "expected": "201 Created",
  "actual": "500 Internal Server Error",
  "status": "OPEN",
  "assignedTo": "Backend Team"
}
```

---

## 8. Reporte Resumido de Prueba (Test Summary Report)

### 8.1 Resumen de Ejecución
| Métrica | Valor |
|---|---|
| Total de pruebas | 50+ |
| Pruebas ejecutadas | — |
| Pruebas exitosas | — |
| Pruebas fallidas | — |
| Tasa de éxito | — |
| Cobertura de código | — |

### 8.2 Recomendaciones
1. Ejecutar pruebas unitarias antes de cada deploy
2. Ejecutar pruebas de integración en pipeline CI/CD
3. Mantener cobertura de código ≥ 70%
4. Documentar cada incidencia encontrada
