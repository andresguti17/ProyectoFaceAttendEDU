# IEEE 829 — Reporte de Incidencias de Prueba (Test Incident Report)

## Formato de Incidencia

```json
{
  "incidentId": "INC-XXX",
  "testId": "TC-XX-XXX",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "summary": "Descripción breve del problema",
  "service": "XX-ms-name",
  "endpoint": "METHOD /api/v1/resource",
  "steps": "Pasos para reproducir",
  "expected": "Resultado esperado",
  "actual": "Resultado obtenido",
  "environment": "development|staging|production",
  "status": "OPEN|IN_PROGRESS|RESOLVED|CLOSED",
  "assignedTo": "Equipo responsable",
  "createdAt": "2026-09-21T10:30:00Z",
  "updatedAt": "2026-09-21T10:30:00Z",
  "resolvedAt": null,
  "notes": "Notas adicionales"
}
```

---

## Incidencias Registradas

### INC-001: Bulk Create no valida duplicados
| Campo | Valor |
|---|---|
| **ID** | INC-001 |
| **Test Case** | TC-05-006 |
| **Severidad** | HIGH |
| **Resumen** | Bulk create permite registros duplicados |
| **Servicio** | 05-ms-attendance |
| **Endpoint** | POST /api/v1/attendance-records/bulk |
| **Pasos** | 1. Enviar array con registros duplicados |
| **Esperado** | Rechazar duplicados con 409 Conflict |
| **Actual** | Crea todos los registros incluyendo duplicados |
| **Estado** | RESUELTO |
| **Asignado** | Backend Team |
| **Resolución** | Agregada validación de unicidad en use case |

### INC-002: Error 500 cuando DB no disponible
| Campo | Valor |
|---|---|
| **ID** | INC-002 |
| **Test Case** | TC-08-001 |
| **Severidad** | CRITICAL |
| **Resumen** | Servicio retorna 500 cuando DB no está disponible |
| **Servicio** | 08-ms-notification |
| **Endpoint** | POST /api/v1/alerts |
| **Pasos** | 1. Detener DB, 2. Enviar request |
| **Esperado** | 503 Service Unavailable con mensaje descriptivo |
| **Actual** | 500 Internal Server Error sin mensaje |
| **Estado** | RESUELTO |
| **Asignado** | Backend Team |
| **Resolución** | Agregada verificación de pool en handler |

### INC-003: Paginación no retorna x-total-count
| Campo | Valor |
|---|---|
| **ID** | INC-003 |
| **Test Case** | TC-03-005 |
| **Severidad** | MEDIUM |
| **Resumen** | Header x-total-count no se incluye en respuesta paginada |
| **Servicio** | 03-ms-academic |
| **Endpoint** | GET /api/v1/schools?limit=10&offset=0 |
| **Pasos** | 1. GET con parámetros de paginación |
| **Esperado** | Header x-total-count con total de registros |
| **Actual** | Header no presente |
| **Estado** | ABIERTO |
| **Asignado** | Backend Team |

### INC-004: Health check no incluye version
| Campo | Valor |
|---|---|
| **ID** | INC-004 |
| **Test Case** | TC-01-010 |
| **Severidad** | LOW |
| **Resumen** | Health check no retorna versión del servicio |
| **Servicio** | 01-ms-identity |
| **Endpoint** | GET /health |
| **Pasos** | 1. GET /health |
| **Esperado** | Campo "version" en respuesta |
| **Actual** | Solo retorna status y service |
| **Estado** | ABIERTO |
| **Asignado** | Backend Team |

---

## Estadísticas de Incidencias

| Severidad | Abiertas | Resueltas | Total |
|---|---|---|---|
| CRITICAL | 0 | 1 | 1 |
| HIGH | 0 | 1 | 1 |
| MEDIUM | 1 | 0 | 1 |
| LOW | 1 | 0 | 1 |
| **Total** | **2** | **2** | **4** |

---

## Tendencia de Calidad

```
Mes Anterior:    ████████████████░░░░ 80% (4 incidencias)
Mes Actual:      ██████████████████░░ 90% (2 incidencias)
Meta:            ████████████████████ 100% (0 incidencias)
```
