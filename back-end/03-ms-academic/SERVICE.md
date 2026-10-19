# Academic Service — `03-ms-academic`

## 1. Responsabilidad

Gestionar la estructura academica completa: sedes educativas, programas curriculares, periodos academicos, cohortes, cursos, actores academicos (estudiantes/instructores) y matriculas.

## 2. Tablas

| Tabla | Descripcion | PK |
|-------|-------------|-----|
| `school` | Sede educativa | `school_id` (INT) |
| `program` | Oferta curricular de una sede | `program_id` (INT) |
| `academic_period` | Ventana temporal (trimestre/semestre) | `academic_period_id` (INT) |
| `cohort` | Grupo de estudiantes en programa + periodo | `cohort_id` (BIGINT) |
| `course` | Materia/asignatura de un programa | `course_id` (INT) |
| `academic_actor_type` | Catalogo: STUDENT / INSTRUCTOR | `actor_type_id` (SMALLINT) |
| `academic_actor` | Rol que una persona cumple en una sede | `academic_actor_id` (BIGINT) |
| `enrollment` | Matricula de actor en una cohorte | `enrollment_id` (BIGINT) |

**Cross-context:** `academic_actor.person_id` referencia a `Identity.person.person_id` (sin FK real)

## 3. Stack Tecnologico

### 3.1 Lenguaje y Framework

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Lenguaje | **TypeScript 5** | Type-safe para modelos academicos y reportes |
| Framework | **Fastify 4** | Alto rendimiento, validacion declarativa con Zod |
| ORM | **Drizzle ORM** | SQL eficiente para JOINs de 8 tablas (mejor que TypeORM) |
| Arquitectura | **Hexagonal** | Misma estructura que los demas servicios |

### 3.2 Dependencias Principales

```json
// package.json
"dependencies": {
  "fastify": "^4.26.0",      // HTTP framework
  "drizzle-orm": "^0.31.0",  // ORM type-safe
  "pg": "^8.11.0",           // PostgreSQL driver
  "zod": "^3.22.0",          // Validacion de schemas
  "kafkajs": "^2.2.4",       // Domain Events
  "pino": "^8.16.0"          // Structured logging
}
```

### 3.3 Librerias Recomendadas Adicionales

| Libreria | Uso | Por que |
|----------|-----|---------|
| **Drizzle ORM** | Persistencia | SQL eficiente y type-safe para JOINs de 8 tablas |
| **Zod** | Validacion | Validacion declarativa de DTOs/queries |
| **Kafkajs** | Domain Events | Publicacion de eventos de dominio |
| **Pino** | Logging | Logs JSON estructurados |
| **Jest + ts-jest** | Tests | Unit tests con TypeScript |
| **Testcontainers** | Tests de integracion | PostgreSQL real en tests |
| **exceljs / pdfmake** | Reportes | Listados de matriculas y constancias |

### 3.4 Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **npm** | Gestion de dependencias |
| **TypeScript (tsc)** | Compilacion |
| **Docker** | Containerizacion |
| **VS Code** | IDE principal |
| **DBeaver** | Cliente PostgreSQL |
| **Postman / Bruno** | Testing REST |

---

## 4. Endpoints

### 4.1 Sedes (School)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/schools` | Crear sede |
| GET | `/api/v1/schools/{id}` | Obtener sede |
| PUT | `/api/v1/schools/{id}` | Actualizar sede |
| PATCH | `/api/v1/schools/{id}/status` | Activar/desactivar |
| GET | `/api/v1/schools` | Listar sedes |

### 4.2 Programas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/schools/{schoolId}/programs` | Crear programa en sede |
| GET | `/api/v1/programs/{id}` | Obtener programa |
| PUT | `/api/v1/programs/{id}` | Actualizar programa |
| GET | `/api/v1/schools/{schoolId}/programs` | Programas de una sede |

### 4.3 Periodos Academicos

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/schools/{schoolId}/periods` | Crear periodo |
| GET | `/api/v1/periods/{id}` | Obtener periodo |
| PUT | `/api/v1/periods/{id}` | Actualizar periodo |
| GET | `/api/v1/schools/{schoolId}/periods` | Periodos de una sede |

### 4.4 Cohortes

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/cohorts` | Crear cohorte |
| GET | `/api/v1/cohorts/{id}` | Obtener cohorte |
| PUT | `/api/v1/cohorts/{id}` | Actualizar cohorte |
| GET | `/api/v1/programs/{programId}/cohorts` | Cohortes de un programa |

### 4.5 Cursos

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/programs/{programId}/courses` | Crear curso en programa |
| GET | `/api/v1/courses/{id}` | Obtener curso |
| PUT | `/api/v1/courses/{id}` | Actualizar curso |
| GET | `/api/v1/programs/{programId}/courses` | Cursos de un programa |

### 4.6 Actores Academicos

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/academic-actors` | Registrar actor (estudiante/instructor) |
| GET | `/api/v1/academic-actors/{id}` | Obtener actor |
| GET | `/api/v1/schools/{schoolId}/actors` | Actores de una sede |
| PATCH | `/api/v1/academic-actors/{id}/status` | Activar/desactivar |

### 4.7 Matriculas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/enrollments` | Crear matricula |
| GET | `/api/v1/enrollments/{id}` | Obtener matricula |
| PATCH | `/api/v1/enrollments/{id}/status` | Cambiar estado (Active/Withdrawn/Completed) |
| GET | `/api/v1/cohorts/{cohortId}/enrollments` | Matriculas de una cohorte |
| GET | `/api/v1/academic-actors/{actorId}/enrollments` | Matriculas de un actor |

---

## 5. Domain Events

| Evento | Trigger | Consumidores tipicos |
|--------|---------|---------------------|
| `SchoolCreated` | Nueva sede | — |
| `SchoolActivated` | Sede activada | — |
| `SchoolDeactivated` | Sede desactivada | Notification |
| `EnrollmentCreated` | Nueva matricula | Notification |
| `EnrollmentStatusChanged` | Estado de matricula cambia | Notification |
| `CohortCreated` | Nueva cohorte | Scheduling |

---

## 6. Relaciones del Modelo

```
school ──> program ──> course
  │            │
  │            └──> cohort <── academic_period
  │                      │
  │                      └──> enrollment ──> academic_actor
  │
  └──> academic_actor ──> academic_actor_type
```

### Diferencias clave

- **program**: Contenedor curricular de mas alto nivel ("Tecnologia en Analisis de Datos")
- **course**: Unidad de contenido dentro de un programa ("Bases de Datos I")
- **cohort**: Grupo concreto de estudiantes que avanza junto ("Ficha 2691234 -- Trimestre 1 de 2026")
- **academic_actor**: Una misma persona puede ser instructor en una sede y estudiante en otra

---

## 7. Configuracion

### .env (ejemplo)

```bash
PORT=8083
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/faceattend_db
DB_SCHEMA=academic
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=academic-service
CACHE_TTL_SECONDS=1800
```

---

## 8. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8083 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |

---

## 9. Stack Actual

Academic esta implementado en **TypeScript + Fastify + Drizzle** con arquitectura hexagonal. El servicio gestiona la estructura academica completa: sedes, programas, periodos, cohortes, cursos, actores y matriculas.

### Justificacion

- **Drizzle ORM**: SQL eficiente y type-safe para los JOINs de las 8 tablas del dominio
- **Zod**: Validacion declarativa de DTOs y filtros de query
- **Kafka (Kafkajs)**: Eventos de dominio para notificaciones
- **Testcontainers**: Tests de integracion con PostgreSQL real
- **Pino**: Logs JSON estructurados
