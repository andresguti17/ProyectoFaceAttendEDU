import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ALL_OBJECTIVE_IDS,
  ISO29110_OBJECTIVE_COUNT,
  ISO29110_PROCESSES,
  ISO29110_WORK_PRODUCTS,
  RATING_LABELS,
  deliveryReadiness,
  processOfObjective,
  rateProcess,
  scoreProcess,
} from '../../domain/iso29110';
import type { ProcessAssessment, QualityProject } from '../../domain/entities/QualityProject';
import type { IProcessAssessmentRepository } from '../../domain/ports/out/IProcessAssessmentRepository';
import type { IQualityProjectRepository } from '../../domain/ports/out/IQualityProjectRepository';

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePagination(query: any): { limit: number; offset: number } {
  let limit = Number(query?.limit ?? 20);
  let offset = Number(query?.offset ?? 0);
  if (!Number.isInteger(limit) || limit <= 0) limit = 20;
  if (!Number.isInteger(offset) || offset < 0) offset = 0;
  return { limit: Math.min(limit, 100), offset };
}

function send400(reply: any, message: string, details?: unknown) {
  return reply.code(400).send({ error: 'BadRequest', message, details, timestamp: new Date().toISOString() });
}

const projectBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  customer: z.string().optional(),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  status: z.enum(['Planned', 'Active', 'Closed']).default('Planned'),
});

const ratingValue = z.enum(['N', 'P', 'L', 'F']);

const assessmentBody = z.object({
  projectId: z.number().int().positive(),
  processId: z.enum(['PM', 'SI']),
  assessor: z.string().min(1),
  ratings: z.record(z.string(), ratingValue),
  comments: z.string().optional(),
  status: z.enum(['Draft', 'Completed']).default('Draft'),
});

function withProcessScore(data: any): ProcessAssessment {
  const score = scoreProcess(data.ratings ?? {}, data.processId);
  return { ...data, score, rating: rateProcess(score) } as ProcessAssessment;
}

export async function registerProcessRoutes(
  app: FastifyInstance,
  projects: IQualityProjectRepository,
  assessments: IProcessAssessmentRepository,
) {
  // ---------- Instrumento (solo lectura): perfil Basic, objetivos y productos ----------
  app.get('/api/v1/quality/process/profile', async () => ({
    standard: 'ISO/IEC 29110 (perfil Basic, adaptado a VSE)',
    totalObjectives: ISO29110_OBJECTIVE_COUNT,
    scale: 'N/P/L/F por objetivo (No alcanzado / Parcialmente / Largamente / Completamente)',
    ratings: RATING_LABELS,
    readinessRule: 'Entrega lista cuando PM y SI superan el 50% (L o F).',
    processes: ISO29110_PROCESSES,
    workProducts: ISO29110_WORK_PRODUCTS,
  }));

  // ---------- Proyectos: crear ----------
  app.post('/api/v1/quality/projects', async (req, reply) => {
    const parsed = projectBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid project payload', parsed.error.flatten());
    const created = await projects.create(parsed.data);
    return reply.code(201).send(created);
  });

  // ---------- Proyectos: listar paginado ----------
  app.get('/api/v1/quality/projects', async (req) => {
    const q = ((req as any).query ?? {}) as any;
    const { limit, offset } = parsePagination(q);
    const { data, total } = await projects.list({ status: q.status }, { limit, offset });
    return { data, total, limit, offset };
  });

  // ---------- Proyectos: detalle ----------
  app.get('/api/v1/quality/projects/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await projects.findById(id) : null;
    if (!found) return reply.code(404).send({ error: 'NotFound', message: 'Project not found' });
    return found;
  });

  // ---------- Proyectos: actualizar ----------
  app.put('/api/v1/quality/projects/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id) return reply.code(404).send({ error: 'NotFound', message: 'Project not found' });
    const parsed = projectBody.partial().safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid project payload', parsed.error.flatten());
    const updated = await projects.update(id, parsed.data);
    if (!updated) return reply.code(404).send({ error: 'NotFound', message: 'Project not found' });
    return updated;
  });

  // ---------- Proyectos: eliminar (soft-delete) ----------
  app.delete('/api/v1/quality/projects/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id || !(await projects.softDelete(id))) return reply.code(404).send({ error: 'NotFound', message: 'Project not found' });
    return reply.code(204).send();
  });

  // ---------- Evaluaciones de proceso: crear ----------
  app.post('/api/v1/quality/assessments', async (req, reply) => {
    const parsed = assessmentBody.safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid assessment payload', parsed.error.flatten());
    if (!(await projects.findById(parsed.data.projectId))) {
      return send400(reply, 'Unknown projectId', { projectId: parsed.data.projectId });
    }
    const proc = ISO29110_PROCESSES.find((p) => p.id === parsed.data.processId)!;
    const expected = proc.objectives.map((o) => o.id);
    const received = Object.keys(parsed.data.ratings);
    const unknown = received.filter((k) => !ALL_OBJECTIVE_IDS.includes(k) || processOfObjective(k) !== parsed.data.processId);
    if (unknown.length) return send400(reply, `Ratings must belong to process ${parsed.data.processId}`, unknown);
    const missing = expected.filter((id) => !received.includes(id));
    if (missing.length) return send400(reply, `All ${expected.length} objectives of ${parsed.data.processId} are required`, missing);
    const created = await assessments.create(withProcessScore(parsed.data));
    return reply.code(201).send(created);
  });

  // ---------- Evaluaciones de proceso: listar ----------
  app.get('/api/v1/quality/assessments', async (req) => {
    const q = ((req as any).query ?? {}) as any;
    const { limit, offset } = parsePagination(q);
    const projectId = q.projectId ? Number(q.projectId) : undefined;
    const { data, total } = await assessments.list({ projectId, processId: q.processId }, { limit, offset });
    return { data, total, limit, offset };
  });

  // ---------- Evaluaciones de proceso: detalle ----------
  app.get('/api/v1/quality/assessments/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const found = id ? await assessments.findById(id) : null;
    if (!found) return reply.code(404).send({ error: 'NotFound', message: 'Assessment not found' });
    return found;
  });

  // ---------- Evaluaciones de proceso: actualizar (recalcula puntaje) ----------
  app.put('/api/v1/quality/assessments/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id) return reply.code(404).send({ error: 'NotFound', message: 'Assessment not found' });
    const parsed = assessmentBody.partial().safeParse((req as any).body);
    if (!parsed.success) return send400(reply, 'Invalid assessment payload', parsed.error.flatten());
    const current = await assessments.findById(id);
    if (!current) return reply.code(404).send({ error: 'NotFound', message: 'Assessment not found' });
    if (parsed.data.projectId && !(await projects.findById(parsed.data.projectId))) {
      return send400(reply, 'Unknown projectId', { projectId: parsed.data.projectId });
    }
    const merged = { ...current, ...parsed.data };
    const proc = ISO29110_PROCESSES.find((p) => p.id === merged.processId)!;
    if (merged.ratings) {
      const expected = proc.objectives.map((o) => o.id);
      const unknown = Object.keys(merged.ratings).filter((k) => !expected.includes(k));
      if (unknown.length) return send400(reply, `Ratings must belong to process ${merged.processId}`, unknown);
    }
    const scored = withProcessScore(merged);
    const updated = await assessments.update(id, { ...parsed.data, score: scored.score, rating: scored.rating });
    if (!updated) return reply.code(404).send({ error: 'NotFound', message: 'Assessment not found' });
    return updated;
  });

  // ---------- Evaluaciones de proceso: eliminar (soft-delete) ----------
  app.delete('/api/v1/quality/assessments/:id', async (req, reply) => {
    const id = parseId((req.params as any).id);
    if (!id || !(await assessments.softDelete(id))) return reply.code(404).send({ error: 'NotFound', message: 'Assessment not found' });
    return reply.code(204).send();
  });

  // ---------- Resumen agregado por proyecto ----------
  app.get('/api/v1/quality/projects/:id/summary', async (req, reply) => {
    const id = parseId((req.params as any).id);
    const project: QualityProject | null = id ? await projects.findById(id) : null;
    if (!project) return reply.code(404).send({ error: 'NotFound', message: 'Project not found' });
    const { data } = await assessments.list({ projectId: id! }, { limit: 1000, offset: 0 });
    const byProcess: Record<string, { score: number; rating: string; assessments: number }> = {};
    for (const p of ISO29110_PROCESSES) {
      const mine = (data as any[]).filter((a) => a.processId === p.id);
      if (!mine.length) continue;
      const avg = Math.round((mine.reduce((acc, a) => acc + (a.score ?? 0), 0) / mine.length) * 10) / 10;
      byProcess[p.id] = { score: avg, rating: rateProcess(avg), assessments: mine.length };
    }
    const scores = Object.values(byProcess).map((b) => b.score);
    const globalScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
    const readiness = deliveryReadiness(Object.fromEntries(Object.entries(byProcess).map(([k, v]) => [k, v.score])));
    return {
      project,
      assessments: (data as any[]).length,
      byProcess,
      globalScore,
      readiness: readiness.label,
      ready: readiness.ready,
    };
  });
}
