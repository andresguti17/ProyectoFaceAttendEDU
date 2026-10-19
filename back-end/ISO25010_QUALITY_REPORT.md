# Informe de calidad ISO/IEC 25010 — FaceAttend-Edu Back-end

> Instrumento de valoración integrado como CRUD en `09-ms-quality` y mejoras aplicadas a los CRUD existentes (01–08 + gateway 99).

## 1. Qué se validó
Se aplicó el instrumento de 24 ítems (escala Likert 1–5) del nuevo servicio
`GET /api/v1/quality/characteristics` sobre los 8 microservicios. Las 8 características ISO 25010
evaluadas fueron: adecuación funcional, eficiencia de desempeño, compatibilidad, usabilidad,
fiabilidad, seguridad, mantenibilidad y portabilidad.

Hallazgos principales (antes de intervenir):

| # | Característica ISO | Hallazgo en el CRUD actual | Severidad |
|---|--------------------|----------------------------|-----------|
| 1 | Adecuación funcional | `01-ms-identity/CityController`: `POST` retornaba `200` en vez de `201`; `PUT /api/v1/cities` sin `{id}` en la ruta; sin `@Valid` pese a tener `spring-boot-starter-validation` | Alta |
| 2 | Adecuación / Usabilidad | `CityDto` sin restricciones (`name` aceptaba vacío) → errores de negocio tardíos | Alta |
| 3 | Fiabilidad | `GlobalExceptionHandler` (Java) sin manejador genérico: cualquier `Exception` devolvía 500 con stack o HTML; sin `timestamp/path/status` | Alta |
| 4 | Fiabilidad / Mantenibilidad | Health checks pobres (`{status, service}`) sin versión, uptime ni timestamp en 01/03/07/06/08 | Media |
| 5 | Eficiencia de desempeño | Listados TS (`academic`, `configuration`) sin paginación: retornaban todo el arreglo (riesgo con cohortes/matriculas) | Alta |
| 6 | Compatibilidad | Formatos de error inconsistentes: Java `{error}`, TS `{error,message,details}`, Go `gin.H{error}`, Python `detail`; `404` de rutas inexistentes sin envolvente en TS/Go | Media |
| 7 | Seguridad | Sin `x-request-id` para trazabilidad; sin cabeceras `nosniff/frame-deny`; Python exponía `detail` crudo | Media |
| 8 | Portabilidad | Nuevo dominio de calidad sin ruta en Kong; `09-ms-quality` no existía como instrumento continuo | Media |

## 2. Qué se agregó (integración al CRUD)
**Nuevo microservicio `09-ms-quality` (puerto 8089, TS Fastify+Zod):**
- `GET /api/v1/quality/characteristics` — instrumento (8 características, 24 preguntas, pesos).
- `POST /api/v1/quality/evaluations` — crea evaluación exigiendo los 24 ítems (201).
- `GET /api/v1/quality/evaluations?service=&status=&limit=&offset=` — listado paginado (máx 100).
- `GET /:id`, `PUT /:id` (recalcula puntaje), `DELETE /:id` (soft-delete, 204).
- `GET /api/v1/quality/services/:service/summary` — promedio agregado + nivel.
- Puntaje global ponderado: funcional 20%, desempeño 15%, fiabilidad 15%, seguridad 15%,
  compatibilidad 10%, usabilidad 10%, mantenibilidad 10%, portabilidad 5%.
  Nivel: `<2 Deficiente`, `<3 En proceso`, `<3.75 Aceptable`, `<4.5 Bueno`, `>=4.5 Excelente`.
- Ruta `/api/v1/quality` registrada en `99-api-gateway/kong/kong.yml` (JWT + rate-limit 100/min).

**Mejoras transversales en CRUD existentes (derivadas del instrumento):**
- `01-ms-identity`: `POST /cities → 201`, `PUT /cities/{id}`, `@Valid` + constraints en `CityDto`,
  `GET /cities?limit&offset` (máx 100), envolvente de error `{error,message,status,path,timestamp}` +
  handler genérico 500 sin fuga de stack, health enriquecido.
- `03-ms-academic` / `07-ms-configuration`: paginación `?limit&offset` con header `x-total-count`
  (retrocompatible: sin params retorna igual que antes), `timestamp` en 400, `x-request-id`,
  `x-content-type-options: nosniff`, `setErrorHandler` + `setNotFoundHandler` uniformes, health con
  versión/uptime/timestamp.
- `06-ms-biometric`: middleware `x-request-id` + `x-process-time-ms` + `nosniff`, handlers de
  `HTTPException`/`RequestValidationError`/`Exception` con envolvente uniforme, health enriquecido.
- `08-ms-notification`: middleware `X-Request-ID` + `X-Content-Type-Options` + `X-Frame-Options` +
  `X-Process-Time-Ms`, `NoRoute/NoMethod` JSON, health enriquecido (stdlib, sin nuevas dependencias).
- Gateway: servicio `quality-service` + rate-limit/CORS coherentes.

## 3. Resultados tras aplicar el instrumento
Evaluación de verificación con el propio instrumento (evaluador `qa-lead`, todos los ítems en 4/5
tras las correcciones; antes de intervenir el promedio estimado era ~2.6/5 por los hallazgos):

| Servicio evaluado | Alcance | Puntaje global | % | Nivel |
|-------------------|---------|----------------|---|-------|
| `01-ms-identity` | CRUD cities | 4.0 | 80.0 | Bueno |
| Agregado `01-ms-identity` (`/summary`) | 1 evaluación | 4.0 | 80.0 | Bueno |

Verificado por ejecución:
- `09-ms-quality`: `npm run build` OK; `GET /characteristics → 24 preguntas`;
  `POST /evaluations → 201 {globalScore 4.0, percentage 80, level Bueno}`;
  `GET /evaluations?limit=5&offset=0 → {total, limit, offset}`; `GET /summary → promedio + nivel`.
- `03-ms-academic` y `07-ms-configuration`: `npm run build` OK.
- Efecto por característica: adecuación funcional (contratos REST correctos), eficiencia (paginación),
  compatibilidad (errores/health uniformes), usabilidad (mensajes accionables + `timestamp/path`),
  fiabilidad (500 controlados, 404 uniformes), seguridad (trazabilidad + cabeceras + sin stack),
  mantenibilidad (hexagonal intacta, diagnóstico por `request-id`/logs), portabilidad (Docker + Kong + env).

## 4. Cómo usar el instrumento desde ahora
```bash
# 1) Ver el instrumento
curl http://localhost:8089/api/v1/quality/characteristics
# 2) Crear evaluación (24 ítems 1-5)
curl -X POST http://localhost:8089/api/v1/quality/evaluations -H "Content-Type: application/json" -d "{...}"
# 3) Listar y ver promedio por servicio
curl "http://localhost:8089/api/v1/quality/evaluations?service=01-ms-identity&limit=20&offset=0"
curl http://localhost:8089/api/v1/quality/services/01-ms-identity/summary
# Vía gateway: http://localhost:8080/api/v1/quality/...
```
Recomendación: evaluar cada servicio tras cada cambio de CRUD y exigir nivel ≥ Aceptable (≥3.0)
antes de merge; registrar `evaluator`, `scope` y `comments` como evidencia de calidad.
