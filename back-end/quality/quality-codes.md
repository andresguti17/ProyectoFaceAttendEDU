# ISO 9001 Quality Error Codes — FaceAttend-Edu

## Catálogo de Códigos de Error

Cada error en el sistema CRUD está clasificado bajo la cláusula ISO/IEC 9001 que lo addressa.

### Validación de Entrada (Cláusula 8.2)
| Código | Descripción | Ejemplo |
|---|---|---|
| `ISO-8.2-VAL-001` | Campo requerido ausente | `"classSessionId is required"` |
| `ISO-8.2-VAL-002` | Formato de dato inválido | `"email must be valid"` |
| `ISO-8.2-VAL-003` | Violación de restricción de enumeración | `"status must be one of [Present,Absent,Late]"` |
| `ISO-8.2-VAL-004` | Violación de rango | `"matchScore must be between 0 and 1"` |
| `ISO-8.2-VAL-005` | Violación de unicidad | `"role name already exists"` |

### Control de Producción (Cláusula 8.5)
| Código | Descripción | Ejemplo |
|---|---|---|
| `ISO-8.5-AUTH-001` | Token de autenticación ausente | `"Authorization header required"` |
| `ISO-8.5-AUTH-002` | Token expirado o inválido | `"JWT token expired"` |
| `ISO-8.5-AUTH-003` | Permiso insuficiente | `"Insufficient permissions for role admin"` |
| `ISO-8.5-INT-001` | Error interno no clasificado | `"Internal server error"` |
| `ISO-8.5-DUP-001` | Conflicto de recurso existente | `"Duplicate entry for key"` |
| `ISO-8.5-INT-002` | Error de conexión a base de datos | `"Database connection failed"` |

### Seguimiento y Medición (Cláusula 9.1)
| Código | Descripción | Ejemplo |
|---|---|---|
| `ISO-9.1-MET-001` | Error en recolección de métricas | `"Metrics collection failed"` |
| `ISO-9.1-MET-002` | Timeout en health check | `"Health check timeout"` |

### No Conformidad (Cláusula 10.2)
| Código | Descripción | Ejemplo |
|---|---|---|
| `ISO-10.2-NC-001` | Excepción no controlada | `"Unexpected null pointer"` |
| `ISO-10.2-NC-002` | Estado incoherente detectado | `"Entity in inconsistent state"` |
| `ISO-10.2-NC-003` | Violación de integridad de datos | `"Foreign key constraint violation"` |

### Información Documentada (Cláusula 7.5)
| Código | Descripción | Ejemplo |
|---|---|---|
| `ISO-7.5-INF-001` | Error de persistencia de log | `"Audit log write failed"` |
| `ISO-7.5-INF-002` | Error de serialización | `"Response serialization error"` |

### Proceso del Sistema (Cláusula 4.4)
| Código | Descripción | Ejemplo |
|---|---|---|
| `ISO-4.4-PRC-001` | Servicio no disponible | `"Service temporarily unavailable"` |
| `ISO-4.4-PRC-002` | Límite de tasa excedido | `"Rate limit exceeded"` |

---

## Formato de Respuesta de Error

```json
{
  "error": {
    "code": "ISO-8.2-VAL-001",
    "message": "classSessionId is required",
    "correlationId": "c9f8a7b6-5e4d-3c2b-a109-8f7e6d5c4b3a",
    "timestamp": "2026-09-21T10:30:00Z",
    "path": "/api/v1/attendance-records",
    "method": "POST",
    "service": "05-ms-attendance",
    "isoClause": "8.2",
    "severity": "ERROR"
  }
}
```
