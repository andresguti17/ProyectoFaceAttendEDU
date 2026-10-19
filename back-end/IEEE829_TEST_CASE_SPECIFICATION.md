# IEEE 829 — Especificación de Casos de Prueba (Test Case Specification)

## 1. Attendance Service (05-ms-attendance)

### TC-05-001: Crear Registro de Asistencia Válido
| Campo | Valor |
|---|---|
| **ID** | TC-05-001 |
| **Nombre** | Crear registro de asistencia con datos válidos |
| **Objetivo** | Verificar que se puede crear un registro de asistencia |
| **Precondiciones** | Servicio activo, classSessionId=100 y academicActorId=200 existen |
| **Datos de Prueba** | `{ classSessionId: 100, academicActorId: 200, attendanceStatus: "Present", captureMethod: "FACIAL", matchScore: 0.95 }` |
| **Pasos** | 1. POST /api/v1/attendance-records con payload válido |
| **Resultado Esperado** | 201 Created con body: `{ attendanceRecordId: <number>, ... }` |
| **Criterios de Aceptación** | attendanceRecordId > 0, attendanceStatus = "Present" |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-05-002: Obtener Registro por ID
| Campo | Valor |
|---|---|
| **ID** | TC-05-002 |
| **Nombre** | Obtener registro de asistencia existente |
| **Objetivo** | Verificar que se puede obtener un registro por su ID |
| **Precondiciones** | Registro TC-05-001 creado (ID = 1) |
| **Datos de Prueba** | ID = 1 |
| **Pasos** | 1. GET /api/v1/attendance-records/1 |
| **Resultado Esperado** | 200 OK con body completo del registro |
| **Criterios de Aceptación** | attendanceRecordId = 1, todos los campos presentes |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-05-003: Actualizar Estado de Asistencia
| Campo | Valor |
|---|---|
| **ID** | TC-05-003 |
| **Nombre** | Actualizar estado de un registro existente |
| **Objetivo** | Verificar que se puede actualizar el estado |
| **Precondiciones** | Registro TC-05-001 existe con status "Present" |
| **Datos de Prueba** | `{ attendanceStatus: "Absent" }` |
| **Pasos** | 1. PUT /api/v1/attendance-records/1 con nuevo status |
| **Resultado Esperado** | 200 OK con attendanceStatus = "Absent" |
| **Criterios de Aceptación** | Status actualizado, updatedAt cambiado |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-05-004: Eliminar Registro (Soft Delete)
| Campo | Valor |
|---|---|
| **ID** | TC-05-004 |
| **Nombre** | Eliminar registro de asistencia |
| **Objetivo** | Verificar soft delete del registro |
| **Precondiciones** | Registro TC-05-001 existe |
| **Datos de Prueba** | ID = 1 |
| **Pasos** | 1. DELETE /api/v1/attendance-records/1 |
| **Resultado Esperado** | 204 No Content |
| **Criterios de Aceptación** | Registro no visible en GET, deletedAt no nulo |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-05-005: Listar Registros con Filtros
| Campo | Valor |
|---|---|
| **ID** | TC-05-005 |
| **Nombre** | Listar registros con filtro por estado |
| **Objetivo** | Verificar filtrado de registros |
| **Precondiciones** | Al menos 1 registro existe |
| **Datos de Prueba** | Query: `?attendanceStatus=Present` |
| **Pasos** | 1. GET /api/v1/attendance-records?attendanceStatus=Present |
| **Resultado Esperado** | 200 OK con array de registros con status "Present" |
| **Criterios de Aceptación** | Todos los registros retornados tienen status "Present" |
| **Prioridad** | Media |
| **Tipo** | Funcional |

### TC-05-006: Crear Registros en Lote (Bulk)
| Campo | Valor |
|---|---|
| **ID** | TC-05-006 |
| **Nombre** | Bulk create de múltiples registros |
| **Objetivo** | Verificar creación masiva |
| **Precondiciones** | Servicio activo |
| **Datos de Prueba** | Array de 3 registros válidos |
| **Pasos** | 1. POST /api/v1/attendance-records/bulk con array |
| **Resultado Esperado** | 201 Created con array de 3 registros |
| **Criterios de Aceptación** | 3 attendanceRecordIds generados |
| **Prioridad** | Media |
| **Tipo** | Funcional |

### TC-05-007: Validar Status Inválido
| Campo | Valor |
|---|---|
| **ID** | TC-05-007 |
| **Nombre** | Crear registro con status inválido |
| **Objetivo** | Verificar validación de entrada |
| **Precondiciones** | Servicio activo |
| **Datos de Prueba** | `{ attendanceStatus: "InvalidStatus" }` |
| **Pasos** | 1. POST /api/v1/attendance-records con status inválido |
| **Resultado Esperado** | 400 Bad Request |
| **Criterios de Aceptación** | Mensaje de error contiene "attendanceStatus" |
| **Prioridad** | Alta |
| **Tipo** | Validación |

### TC-05-008: Obtener Registro Inexistente
| Campo | Valor |
|---|---|
| **ID** | TC-05-008 |
| **Nombre** | Obtener registro que no existe |
| **Objetivo** | Verificar manejo de 404 |
| **Precondiciones** | Ninguna |
| **Datos de Prueba** | ID = 999999 |
| **Pasos** | 1. GET /api/v1/attendance-records/999999 |
| **Resultado Esperado** | 404 Not Found |
| **Criterios de Aceptación** | Mensaje de error contiene "not found" |
| **Prioridad** | Alta |
| **Tipo** | Manejo de errores |

---

## 2. Notification Service (08-ms-notification)

### TC-08-001: Crear Alerta Válida
| Campo | Valor |
|---|---|
| **ID** | TC-08-001 |
| **Nombre** | Crear alerta con datos válidos |
| **Objetivo** | Verificar creación de alerta |
| **Precondiciones** | AlertType con ID=1 existe |
| **Datos de Prueba** | `{ academic_actor_id: 100, alert_type_id: 1 }` |
| **Pasos** | 1. POST /api/v1/alerts |
| **Resultado Esperado** | 201 Created |
| **Criterios de Aceptación** | alert_id > 0 |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-08-002: Resolver Alerta
| Campo | Valor |
|---|---|
| **ID** | TC-08-002 |
| **Nombre** | Marcar alerta como resuelta |
| **Objetivo** | Verificar resolución de alerta |
| **Precondiciones** | Alerta TC-08-001 existe |
| **Datos de Prueba** | ID = 1 |
| **Pasos** | 1. PUT /api/v1/alerts/1/resolve |
| **Resultado Esperado** | 200 OK con resolved_at no nulo |
| **Criterios de Aceptación** | resolved_at es timestamp válido |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-08-003: Obtener Alerta por ID
| Campo | Valor |
|---|---|
| **ID** | TC-08-003 |
| **Nombre** | Obtener alerta existente |
| **Objetivo** | Verificar lectura de alerta |
| **Precondiciones** | Alerta TC-08-001 existe |
| **Datos de Prueba** | ID = 1 |
| **Pasos** | 1. GET /api/v1/alerts/1 |
| **Resultado Esperado** | 200 OK con datos de alerta |
| **Criterios de Aceptación** | Todos los campos presentes |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-08-004: Eliminar Alerta
| Campo | Valor |
|---|---|
| **ID** | TC-08-004 |
| **Nombre** | Eliminar alerta |
| **Objetivo** | Verificar eliminación de alerta |
| **Precondiciones** | Alerta TC-08-001 existe |
| **Datos de Prueba** | ID = 1 |
| **Pasos** | 1. DELETE /api/v1/alerts/1 |
| **Resultado Esperado** | 204 No Content |
| **Criterios de Aceptación** | Alerta no visible en GET |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-08-005: Listar Alertas
| Campo | Valor |
|---|---|
| **ID** | TC-08-005 |
| **Nombre** | Listar todas las alertas |
| **Objetivo** | Verificar listado de alertas |
| **Precondiciones** | Al menos 1 alerta existe |
| **Datos de Prueba** | Ninguno |
| **Pasos** | 1. GET /api/v1/alerts |
| **Resultado Esperado** | 200 OK con array de alertas |
| **Criterios de Aceptación** | Array no vacío |
| **Prioridad** | Media |
| **Tipo** | Funcional |

---

## 3. Academic Service (03-ms-academic)

### TC-03-001: Crear Escuela
| Campo | Valor |
|---|---|
| **ID** | TC-03-001 |
| **Nombre** | Crear escuela con datos válidos |
| **Objetivo** | Verificar creación de escuela |
| **Precondiciones** | Servicio activo |
| **Datos de Prueba** | `{ code: "SCH001", name: "Test School", cityId: 1 }` |
| **Pasos** | 1. POST /api/v1/schools |
| **Resultado Esperado** | 201 Created con schoolId |
| **Criterios de Aceptación** | schoolId > 0 |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-03-002: Crear Programa
| Campo | Valor |
|---|---|
| **ID** | TC-03-002 |
| **Nombre** | Crear programa asociado a escuela |
| **Objetivo** | Verificar creación de programa |
| **Precondiciones** | Escuela TC-03-001 existe |
| **Datos de Prueba** | `{ schoolId: 1, code: "PRG001", name: "Computer Science" }` |
| **Pasos** | 1. POST /api/v1/programs |
| **Resultado Esperado** | 201 Created con programId |
| **Criterios de Aceptación** | programId > 0 |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

### TC-03-003: Crear Período Académico
| Campo | Valor |
|---|---|
| **ID** | TC-03-003 |
| **Nombre** | Crear período académico |
| **Objetivo** | Verificar creación de período |
| **Precondiciones** | Servicio activo |
| **Datos de Prueba** | `{ schoolId: 1, name: "2026-Q1", startsOn: "2026-01-01", endsOn: "2026-03-31" }` |
| **Pasos** | 1. POST /api/v1/academic-periods |
| **Resultado Esperado** | 201 Created con academicPeriodId |
| **Criterios de Aceptación** | academicPeriodId > 0 |
| **Prioridad** | Alta |
| **Tipo** | Funcional |

---

## 4. Casos de Prueba de Validación

### TC-VAL-001: Email Inválido
| Campo | Valor |
|---|---|
| **ID** | TC-VAL-001 |
| **Nombre** | Validar formato de email |
| **Datos de Prueba** | `{ email: "invalid-email" }` |
| **Resultado Esperado** | 400 Bad Request |
| **Prioridad** | Alta |

### TC-VAL-002: Campo Requerido Ausente
| Campo | Valor |
|---|---|
| **ID** | TC-VAL-002 |
| **Nombre** | Validar campo requerido |
| **Datos de Prueba** | `{}` (objeto vacío) |
| **Resultado Esperado** | 400 Bad Request |
| **Prioridad** | Alta |

### TC-VAL-003: Enum Inválido
| Campo | Valor |
|---|---|
| **ID** | TC-VAL-003 |
| **Nombre** | Validar valor de enumeración |
| **Datos de Prueba** | `{ attendanceStatus: "INVALID" }` |
| **Resultado Esperado** | 400 Bad Request |
| **Prioridad** | Alta |

### TC-VAL-004: Fuera de Rango
| Campo | Valor |
|---|---|
| **ID** | TC-VAL-004 |
| **Nombre** | Validar rango numérico |
| **Datos de Prueba** | `{ matchScore: 1.5 }` (debe ser 0-1) |
| **Resultado Esperado** | 400 Bad Request |
| **Prioridad** | Media |
