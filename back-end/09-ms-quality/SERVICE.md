# Quality Service (`09-ms-quality`) — TypeScript Fastify 8089

## Responsabilidad
CRUD del **instrumento de valoración ISO/IEC 25010:2011** (calidad de producto), del
**instrumento ISO/IEC 29110 perfil Basic** (procesos PM + SI para VSE) y del
**instrumento ISTQB CTFL v4.0** (madurez de pruebas, 6 áreas, 30 ítems).
Tablas lógicas (in-memory, patrón 03/07): `quality_evaluation`, `quality_project`,
`process_assessment`, `istqb_assessment` (soft-delete `deletedAt`).

## Stack
TypeScript + Fastify + Zod (igual que `07-ms-configuration`). Puerto **8089**. Sin FK cross-context.

## Endpoints
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/quality/characteristics` | Instrumento: 8 características, 24 ítems Likert 1-5, pesos |
| POST | `/api/v1/quality/evaluations` | Crear evaluación (201; exige los 24 ítems) |
| GET | `/api/v1/quality/evaluations?service=&status=&limit=&offset=` | Listar paginado (máx 100) |
| GET | `/api/v1/quality/evaluations/:id` | Detalle con puntaje ponderado |
| PUT | `/api/v1/quality/evaluations/:id` | Actualizar y recalcular puntaje |
| DELETE | `/api/v1/quality/evaluations/:id` | Soft-delete (204) |
| GET | `/api/v1/quality/services/:service/summary` | Promedio agregado por servicio + nivel |
| GET | `/api/v1/quality/process/profile` | Instrumento 29110: procesos PM/SI, 20 objetivos, 11 productos, escala N/P/L/F |
| POST | `/api/v1/quality/projects` | Crear proyecto (201) |
| GET | `/api/v1/quality/projects?status=&limit=&offset=` | Listar proyectos paginado |
| GET/PUT/DELETE | `/api/v1/quality/projects/:id` | Detalle / actualizar / soft-delete (204) |
| POST | `/api/v1/quality/assessments` | Crear evaluación de proceso (201; exige objetivos del proceso + `projectId` válido) |
| GET | `/api/v1/quality/assessments?projectId=&processId=&limit=&offset=` | Listar evaluaciones |
| GET/PUT/DELETE | `/api/v1/quality/assessments/:id` | Detalle / actualizar y recalcular / soft-delete |
| GET | `/api/v1/quality/projects/:id/summary` | Puntaje por proceso + global + preparación para entrega |
| GET | `/api/v1/quality/istqb/categories` | Instrumento ISTQB: 6 categorías CTFL 4.0, 30 ítems Likert 1-5, pesos |
| GET | `/api/v1/quality/istqb/characteristics` | Alias del anterior |
| POST | `/api/v1/quality/istqb/assessments` | Crear evaluación ISTQB (201; exige los 30 ítems) |
| GET | `/api/v1/quality/istqb/assessments?service=&status=&projectId=&limit=&offset=` | Listar evaluaciones ISTQB paginado |
| GET/PUT/DELETE | `/api/v1/quality/istqb/assessments/:id` | Detalle / actualizar y recalcular / soft-delete |
| GET | `/api/v1/quality/istqb/services/:service/summary` | Promedio ISTQB agregado por servicio + nivel |
| GET | `/health`, `/api/v1/health` | Salud enriquecida (versión, uptime, timestamp) |

## Modelo de puntaje
Cada subcaracterística se califica 1-5. Promedio por característica y
**global ponderado**: Funcional 20%, Desempeño 15%, Fiabilidad 15%, Seguridad 15%,
Compatibilidad 10%, Usabilidad 10%, Mantenibilidad 10%, Portabilidad 5%.
Nivel: `<2 Deficiente`, `<3 En proceso`, `<3.75 Aceptable`, `<4.5 Bueno`, `>=4.5 Excelente`.

## Modelo de puntaje 29110
Cada objetivo se califica N/P/L/F (0/1/2/3). Puntaje del proceso = % sobre el máximo;
calificación agregada N ≤15%, P ≤50%, L ≤85%, F >85% (umbrales adaptados de ISO/IEC 33020).
Global = promedio de PM y SI. Entrega lista solo si PM y SI superan el 50%.
Las evaluaciones 25010 aceptan `projectId` opcional (trazabilidad SI.O2).

## Modelo de puntaje ISTQB
Cada ítem se califica 1-5. Promedio por categoría y **global ponderado**: fundamentos 15%, ciclo 15%, estáticas 15%, técnicas 20%, gestión 20%, herramientas 15%.
Nivel: `<2 Deficiente`, `<3 En proceso`, `<3.75 Aceptable`, `<4.5 Bueno`, `>=4.5 Excelente`.
Las evaluaciones ISTQB aceptan `projectId` opcional (trazabilidad SI.O2/SI.O7).

## Ejecución
```bash
npm install
npm run dev    # :8089
npm run build && npm start
```
Gateway: ruta `/api/v1/quality` en `99-api-gateway/kong/kong.yml` (servicio `quality-service`).
