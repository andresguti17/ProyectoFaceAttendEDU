import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ALL_SUBCHARACTERISTIC_IDS,
  ISO25010_CHARACTERISTICS,
  ISO25010_QUESTION_COUNT,
  scoreEvaluation,
} from '../../domain/iso25010';
import type { QualityEvaluation } from '../../domain/entities/QualityEvaluation';
import type { IQualityEvaluationRepository } from '../../domain/ports/out/IQualityEvaluationRepository';

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePagination(query: any): { limit: number; offset: number } {
  let limit = Number(query?.limit ?? 20);
  let offset = Number(query?.offset ?? 0);
  if (!Number.isInteger(limit) || limit <= 0) limit = 20;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;
  limit = Math.min(limit, 100);
  return { limit, offset };
}

function send400(reply: any, message: string, details?: unknown) {
  return reply.code(400).send({ error: 'BadRequest', message, details, timestamp: new Date().toISOString() });
}

const scoresSchema = z.record(z.string(), z.number().int().min(1).max(5));

const evaluationBody = z.object({
  service: z.string().min(1),
  evaluator: z.string().min(1),
  scope: z.string().min(1),
  scores: scoresSchema,
  comments: z.string().optional(),
  status: z.enum(['Draft', 'Completed']).default('Draft'),
  // ISO 29110 SI.O2 — trazabilidad: la evaluación de producto puede ligarse a un proyecto.
  projectId: z.number().int().positive().optional(),
});

function withScore(data: any): QualityEvaluation {
  const scored = scoreEvaluation(data.scores ?? {});
  return { ...data, ...scored } as QualityEvaluation;
}

export async function registerQualityRoutes(app: FastifyInstance, evaluations: IQualityEvaluationRepository) {
  // ---------- Instrumento (solo lectura): características, preguntas y pesos ----------
  app.get('/api/v1/quality/characteristics', async () => ({
    standard: 'ISO/IEC 25010:2011',
    totalQuestions: ISO25010_QUESTION_COUNT,
    scale: 'Likert 1-5 (1=totalmente en desacuerdo, 5=totalmente de acuerdo)',
    characteristics: ISO25010_CHARACTERISTICS,
  }));

  // ---------- Crear evaluación ----------
  app.post('/api/v1/quality/evaluations', async (req, reply) => {
    const parsed = evaluationBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid evaluation payload', parsed.error.flatten());
    const unknownIds = Object.keys(parsed.data.scores).filter((k) => !ALL_SUBCHARACTERISTIC_IDS.includes(k));
    if (unknownIds.length) return send400(reply, 'Unknown subcharacteristic ids', unknownIds);
    if (Object.keys(parsed.data.scores).length !== ISO25010_QUESTION_COUNT) {
      return send400(reply, `All ${ISO25010_QUESTION_COUNT} items are required`, { expected: ISO25010_QUESTION_COUNT, received: Object.keys(parsed.data.scores).length });
    }
    const created = await evaluations.create(withScore(parsed.data));
    return reply.code(201).send(created);
  });

  // ---------- Listar (paginado + filtro por servicio) ----------
  app.get('/api/v1/quality/evaluations', async (req) => {
    const q = ((req as any).query ?? {}) as any;
    const { limit, offset } = parsePagination(q);
    const { data, total } = await evaluations.list({ service: q.service, status: q.status }, { limit, offset });
    return { data, total, limit, offset };
  });

  // ---------- Detalle ----------
  app.get('/api/v1/quality/evaluations/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await evaluations.findById(id) : null;
    if (!found) return reply.code(404).send({ error: 'NotFound', message: 'Evaluation not found' });
    return found;
  });

  // ---------- Actualizar (re-calcula puntaje) ----------
  app.put('/api/v1/quality/evaluations/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id) return reply.code(404).send({ error: 'NotFound', message: 'Evaluation not found' });
    const parsed = evaluationBody.partial().safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid evaluation payload', parsed.error.flatten());
    if (parsed.data.scores) {
      const unknownIds = Object.keys(parsed.data.scores).filter((k) => !ALL_SUBCHARACTERISTIC_IDS.includes(k));
      if (unknownIds.length) return send400(reply, 'Unknown subcharacteristic ids', unknownIds);
    }
    const current = await evaluations.findById(id);
    if (!current) return reply.code(404).send({ error: 'NotFound', message: 'Evaluation not found' });
    const merged = { ...current, ...parsed.data };
    const updated = await evaluations.update(id, { ...parsed.data, ...scoreEvaluation(merged.scores ?? {}) });
    if (!updated) return reply.code(404).send({ error: 'NotFound', message: 'Evaluation not found' });
    return updated;
  });

  // ---------- Eliminar (soft-delete) ----------
  app.delete('/api/v1/quality/evaluations/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id || !(await evaluations.softDelete(id))) return reply.code(404).send({ error: 'NotFound', message: 'Evaluation not found' });
    return reply.code(204).send();
  });

  // ---------- Resumen agregado por servicio ----------
  app.get('/api/v1/quality/services/:service/summary', async (req) => {
    const service = decodeURIComponent((req.params as any).service);
    const { data, total } = await evaluations.list({ service }, { limit: 1000, offset: 0 });
    if (!total) return { service, evaluations: 0, averageScore: null, averagePercentage: null, level: null, byCharacteristic: {} };
    const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
    const byChar: Record<string, number[]> = {};
    for (const e of data as any[]) {
      for (const [k, v] of Object.entries((e.byCharacteristic ?? {}) as Record<string, number>)) {
        (byChar[k] ??= []).push(v);
      }
    }
    const byCharacteristic: Record<string, number> = {};
    for (const [k, v] of Object.entries(byChar)) byCharacteristic[k] = avg(v);
    const averageScore = avg((data as any[]).map((e) => e.globalScore ?? 0));
    return {
      service,
      evaluations: total,
      averageScore,
      averagePercentage: Math.round((averageScore / 5) * 1000) / 10,
      level: averageScore < 2 ? 'Deficiente' : averageScore < 3 ? 'En proceso' : averageScore < 3.75 ? 'Aceptable' : averageScore < 4.5 ? 'Bueno' : 'Excelente',
      byCharacteristic,
    };
  });
}
