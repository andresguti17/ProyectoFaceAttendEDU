import Fastify, { type FastifyInstance } from 'fastify';
import { registerQualityRoutes } from '../infrastructure/http/routes';
import { ALL_SUBCHARACTERISTIC_IDS } from '../domain/iso25010';
import type { QualityEvaluation } from '../domain/entities/QualityEvaluation';
import type {
  IQualityEvaluationRepository,
  QualityEvaluationFilter,
  QualityEvaluationInput,
  QualityEvaluationPatch,
} from '../domain/ports/out/IQualityEvaluationRepository';
import type { ListPage, PagedResult } from '../domain/ports/out/Paging';

/** Minimal in-memory fake standing in for the Postgres repository. */
class FakeEvaluationRepository implements IQualityEvaluationRepository {
  private rows: QualityEvaluation[] = [];
  private nextId = 1;

  async create(input: QualityEvaluationInput): Promise<QualityEvaluation> {
    const row: QualityEvaluation = {
      ...input,
      evaluationId: this.nextId++,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    } as QualityEvaluation;
    this.rows.push(row);
    return row;
  }

  async findById(id: number): Promise<QualityEvaluation | null> {
    return this.rows.find((r) => r.evaluationId === id) ?? null;
  }

  async list(filter: QualityEvaluationFilter, page: ListPage): Promise<PagedResult<QualityEvaluation>> {
    const filtered = this.rows.filter(
      (r) => (!filter.service || r.service === filter.service) && (!filter.status || r.status === filter.status),
    );
    return { data: filtered.slice(page.offset, page.offset + page.limit), total: filtered.length };
  }

  async update(id: number, patch: QualityEvaluationPatch): Promise<QualityEvaluation | null> {
    const idx = this.rows.findIndex((r) => r.evaluationId === id);
    if (idx === -1) return null;
    this.rows[idx] = { ...this.rows[idx], ...patch } as QualityEvaluation;
    return this.rows[idx];
  }

  async softDelete(id: number): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.evaluationId === id);
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }
}

function fullScores(value = 4): Record<string, number> {
  return Object.fromEntries(ALL_SUBCHARACTERISTIC_IDS.map((id) => [id, value]));
}

describe('registerQualityRoutes', () => {
  let app: FastifyInstance;
  let repo: FakeEvaluationRepository;

  beforeEach(async () => {
    app = Fastify();
    repo = new FakeEvaluationRepository();
    await registerQualityRoutes(app, repo);
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects a payload that uses an unknown subcharacteristic id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/evaluations',
      payload: { service: 's', evaluator: 'e', scope: 'sc', scores: { 'not-a-real-id': 5 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Unknown subcharacteristic ids');
  });

  it('rejects a payload with fewer items than the full instrument', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/evaluations',
      payload: { service: 's', evaluator: 'e', scope: 'sc', scores: { 'functional-completeness': 5 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/items are required/);
  });

  it('creates an evaluation and computes/persists the derived score alongside it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/evaluations',
      payload: { service: 's', evaluator: 'e', scope: 'sc', scores: fullScores(4) },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.globalScore).toBe(4);
    expect(body.level).toBe('Bueno');
  });

  it('returns 404 for a missing evaluation on GET by id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/quality/evaluations/999' });
    expect(res.statusCode).toBe(404);
  });

  it('re-validates unknown subcharacteristic ids on PUT before merging', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/evaluations',
      payload: { service: 's', evaluator: 'e', scope: 'sc', scores: fullScores(3) },
    });
    const id = created.json().evaluationId;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/quality/evaluations/${id}`,
      payload: { scores: { 'bogus-id': 5 } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('recomputes the derived score on PUT using the merged scores', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/evaluations',
      payload: { service: 's', evaluator: 'e', scope: 'sc', scores: fullScores(3) },
    });
    const id = created.json().evaluationId;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/quality/evaluations/${id}`,
      payload: { scores: fullScores(5) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().globalScore).toBe(5);
    expect(res.json().level).toBe('Excelente');
  });

  it('returns 404 on PUT/DELETE for an id that does not exist', async () => {
    const put = await app.inject({ method: 'PUT', url: '/api/v1/quality/evaluations/999', payload: {} });
    expect(put.statusCode).toBe(404);
    const del = await app.inject({ method: 'DELETE', url: '/api/v1/quality/evaluations/999' });
    expect(del.statusCode).toBe(404);
  });

  describe('GET /services/:service/summary', () => {
    it('returns a null/zero shape when the service has no evaluations, without crashing', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/quality/services/unknown-service/summary' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.evaluations).toBe(0);
      expect(body.averageScore).toBeNull();
      expect(body.level).toBeNull();
    });

    it('averages globalScore and byCharacteristic across all evaluations for the service', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/quality/evaluations',
        payload: { service: 'svc', evaluator: 'e', scope: 'sc', scores: fullScores(3) },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/quality/evaluations',
        payload: { service: 'svc', evaluator: 'e', scope: 'sc', scores: fullScores(5) },
      });

      const res = await app.inject({ method: 'GET', url: '/api/v1/quality/services/svc/summary' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.evaluations).toBe(2);
      expect(body.averageScore).toBe(4);
      expect(body.level).toBe('Bueno');
    });
  });
});
