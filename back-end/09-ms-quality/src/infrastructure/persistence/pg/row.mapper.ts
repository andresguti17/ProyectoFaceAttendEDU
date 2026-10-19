import type { IstqbAssessment } from '../../../domain/entities/IstqbAssessment';
import type { ProcessAssessment, QualityProject } from '../../../domain/entities/QualityProject';
import type { QualityEvaluation } from '../../../domain/entities/QualityEvaluation';

/**
 * Mapeo puro fila (snake_case) → entidad de dominio (camelCase).
 *
 * Sin dependencias de `pg` ni de I/O: estas funciones son unit-testeables sin base de datos.
 * La forma del JSON devuelto por la API NO cambia respecto a la versión en memoria:
 * las claves opcionales se omiten cuando vienen NULL (igual que `MemoryStore`).
 */

/** PostgreSQL `timestamp without time zone` llega como cadena cruda (ver db/database.ts). */
export type RawTimestamp = string | Date | null;
/** PostgreSQL `date` puede llegar como cadena `YYYY-MM-DD` o como `Date` local. */
export type RawDate = string | Date | null;

/** `'2026-09-23 14:03:22.123456'` → `'2026-09-23T14:03:22.123Z'` (los TIMESTAMP se guardan en UTC). */
export function toIsoTimestamp(raw: RawTimestamp): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw.toISOString();
  const text = raw.trim();
  if (!text) return null;
  const parsed = new Date(text.includes('T') ? text : `${text.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Normaliza una columna `DATE` a `YYYY-MM-DD` sin desplazar el día por zona horaria. */
export function toDateOnly(raw: RawDate): string | null {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) {
    // pg construye el Date a medianoche LOCAL: hay que formatear con getters locales.
    const y = raw.getFullYear();
    const m = `${raw.getMonth() + 1}`.padStart(2, '0');
    const d = `${raw.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = raw.trim();
  return text ? text.slice(0, 10) : null;
}

/** Elimina claves `null`/`undefined` preservando el orden de inserción. */
export function omitNullish<T extends object>(value: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item !== null && item !== undefined) out[key] = item;
  }
  return out as Partial<T>;
}

// ───────────────────────── Filas (snake_case) ─────────────────────────

export interface QualityProjectRow {
  project_id: number;
  project_name: string;
  description: string | null;
  customer: string | null;
  planned_start_on: RawDate;
  planned_end_on: RawDate;
  project_status: string;
  created_at: RawTimestamp;
  updated_at: RawTimestamp;
  deleted_at: RawTimestamp;
}

export interface QualityEvaluationRow {
  evaluation_id: number;
  service_name: string;
  evaluator_name: string;
  evaluation_scope: string;
  project_id: number | null;
  evaluation_status: string;
  comments: string | null;
  global_score: number | null;
  percentage: number | null;
  quality_level: string | null;
  created_at: RawTimestamp;
  updated_at: RawTimestamp;
  deleted_at: RawTimestamp;
}

export interface ProcessAssessmentRow {
  assessment_id: number;
  project_id: number;
  process_code: string;
  assessor_name: string;
  assessment_status: string;
  comments: string | null;
  process_score: number | null;
  process_rating: string | null;
  created_at: RawTimestamp;
  updated_at: RawTimestamp;
  deleted_at: RawTimestamp;
}

export interface IstqbAssessmentRow {
  istqb_assessment_id: number;
  service_name: string;
  evaluator_name: string;
  assessment_scope: string;
  project_id: number | null;
  assessment_status: string;
  comments: string | null;
  global_score: number | null;
  percentage: number | null;
  quality_level: string | null;
  created_at: RawTimestamp;
  updated_at: RawTimestamp;
  deleted_at: RawTimestamp;
}

// ───────────────────────── Mapeo a entidades ─────────────────────────

export function mapQualityProjectRow(row: QualityProjectRow): QualityProject {
  return {
    projectId: row.project_id,
    name: row.project_name,
    ...omitNullish({
      description: row.description ?? undefined,
      customer: row.customer ?? undefined,
      plannedStart: toDateOnly(row.planned_start_on) ?? undefined,
      plannedEnd: toDateOnly(row.planned_end_on) ?? undefined,
    }),
    status: row.project_status as QualityProject['status'],
    createdAt: toIsoTimestamp(row.created_at) ?? '',
    updatedAt: toIsoTimestamp(row.updated_at) ?? '',
    deletedAt: toIsoTimestamp(row.deleted_at),
  };
}

export function mapQualityEvaluationRow(
  row: QualityEvaluationRow,
  scores: Record<string, number>,
  byCharacteristic: Record<string, number>,
): QualityEvaluation {
  return {
    evaluationId: row.evaluation_id,
    service: row.service_name,
    evaluator: row.evaluator_name,
    scope: row.evaluation_scope,
    scores,
    ...omitNullish({ comments: row.comments ?? undefined }),
    status: row.evaluation_status as QualityEvaluation['status'],
    ...omitNullish({
      projectId: row.project_id ?? undefined,
      byCharacteristic,
      globalScore: row.global_score ?? undefined,
      percentage: row.percentage ?? undefined,
      level: row.quality_level ?? undefined,
    }),
    createdAt: toIsoTimestamp(row.created_at) ?? '',
    updatedAt: toIsoTimestamp(row.updated_at) ?? '',
    deletedAt: toIsoTimestamp(row.deleted_at),
  };
}

export function mapProcessAssessmentRow(
  row: ProcessAssessmentRow,
  ratings: Record<string, string>,
): ProcessAssessment {
  return {
    assessmentId: row.assessment_id,
    projectId: row.project_id,
    processId: row.process_code,
    assessor: row.assessor_name,
    ratings,
    ...omitNullish({ comments: row.comments ?? undefined }),
    status: row.assessment_status as ProcessAssessment['status'],
    ...omitNullish({ score: row.process_score ?? undefined, rating: row.process_rating ?? undefined }),
    createdAt: toIsoTimestamp(row.created_at) ?? '',
    updatedAt: toIsoTimestamp(row.updated_at) ?? '',
    deletedAt: toIsoTimestamp(row.deleted_at),
  };
}

export function mapIstqbAssessmentRow(
  row: IstqbAssessmentRow,
  scores: Record<string, number>,
  byCategory: Record<string, number>,
): IstqbAssessment {
  return {
    assessmentId: row.istqb_assessment_id,
    service: row.service_name,
    evaluator: row.evaluator_name,
    scope: row.assessment_scope,
    scores,
    ...omitNullish({ comments: row.comments ?? undefined }),
    status: row.assessment_status as IstqbAssessment['status'],
    // Mismo orden de claves que emitía la implementación en memoria
    // (`{ ...payload, ...scored }` → projectId, byCategory, globalScore, percentage, level).
    ...omitNullish({
      projectId: row.project_id ?? undefined,
      byCategory,
      globalScore: row.global_score ?? undefined,
      percentage: row.percentage ?? undefined,
      level: row.quality_level ?? undefined,
    }),
    createdAt: toIsoTimestamp(row.created_at) ?? '',
    updatedAt: toIsoTimestamp(row.updated_at) ?? '',
    deletedAt: toIsoTimestamp(row.deleted_at),
  };
}
