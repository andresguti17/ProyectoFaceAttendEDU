import Fastify, { type FastifyInstance } from 'fastify';
import { registerIstqbRoutes } from '../infrastructure/http/istqb.routes';
import { ALL_ISTQB_ITEM_IDS, ISTQB_QUESTION_COUNT } from '../domain/istqb';
import type { IstqbAssessment } from '../domain/entities/IstqbAssessment';

/** In-memory port with the same contract as the PostgreSQL adapter (soft delete, paging, filters). */
class FakeIstqbRepository {
  rows: IstqbAssessment[] = [];
  private next = 1;
  async create(input: any) {
    const row = { ...input, assessmentId: this.next++, createdAt: 'x', updatedAt: 'x', deletedAt: null };
    this.rows.push(row);
    return row;
  }
  async findById(id: number) {
    return this.rows.find((r) => r.assessmentId === id && !r.deletedAt) ?? null;
  }
  async list(filter: any, page: { limit: number; offset: number }) {
    const live = this.rows.filter((r: any) => !r.deletedAt
      && (!filter.service || r.service === filter.service)
      && (!filter.status || r.status === filter.status)
      && (!filter.projectId || r.projectId === filter.projectId));
    return { data: live.slice(page.offset, page.offset + page.limit), total: live.length };
  }
  async update(id: number, patch: any) {
    const row: any = await this.findById(id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async softDelete(id: number) {
    const row: any = await this.findById(id);
    if (!row) return false;
    row.deletedAt = 'now';
    return true;
  }
}

const allScores = (value: number) => Object.fromEntries(ALL_ISTQB_ITEM_IDS.map((id) => [id, value]));
const body = (service: string, value: number, extra: Record<string, unknown> = {}) =>
  ({ service, evaluator: 'QA', scope: 'API', scores: allScores(value), ...extra });

let app: FastifyInstance;
let repo: FakeIstqbRepository;

beforeEach(async () => {
  repo = new FakeIstqbRepository();
  app = Fastify();
  await registerIstqbRoutes(app, repo as any);
});

afterEach(async () => {
  await app.close();
});

const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/v1/quality/istqb/assessments', payload: payload as any });

describe('ISTQB instrument', () => {
  it('publishes the categories under both paths', async () => {
    for (const url of ['/api/v1/quality/istqb/categories', '/api/v1/quality/istqb/characteristics']) {
      const res = (await app.inject({ method: 'GET', url })).json();
      expect(res.totalQuestions).toBe(ISTQB_QUESTION_COUNT);
      expect(res.categories.length).toBeGreaterThan(0);
    }
  });
});

describe('ISTQB assessments', () => {
  it('requires every item, rejects unknown ids and scores the evaluation', async () => {
    expect((await post({ service: 'x' })).statusCode).toBe(400);
    const unknown = await post({ ...body('ms-identity', 4), scores: { ...allScores(4), nope: 3 } });
    expect(unknown.json().message).toBe('Unknown ISTQB item ids');
    const partial = await post({ ...body('ms-identity', 4), scores: { [ALL_ISTQB_ITEM_IDS[0]]: 4 } });
    expect(partial.json().details).toEqual({ expected: ISTQB_QUESTION_COUNT, received: 1 });
    const created = await post(body('ms-identity', 4));
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ status: 'Draft', globalScore: 4, level: expect.any(String) });
  });

  it('lists with paging and filters, and reads one', async () => {
    await post(body('ms-identity', 4));
    await post(body('ms-academic', 2, { status: 'Completed', projectId: 7 }));
    const page = (await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/assessments?limit=1&offset=1' })).json();
    expect(page).toMatchObject({ total: 2, limit: 1, offset: 1 });
    const filtered = (await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/assessments?service=ms-academic&status=Completed&projectId=7' })).json();
    expect(filtered.data.map((a: any) => a.service)).toEqual(['ms-academic']);
    expect((await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/assessments/1' })).json().service).toBe('ms-identity');
    expect((await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/assessments/99' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/assessments?limit=0&offset=-1' })).json()).toMatchObject({ limit: 20, offset: 0 });
  });

  it('updating the scores recalculates the score; bad ids and payloads are rejected', async () => {
    await post(body('ms-identity', 2));
    const url = '/api/v1/quality/istqb/assessments/1';
    expect((await app.inject({ method: 'PUT', url: '/api/v1/quality/istqb/assessments/abc', payload: {} })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PUT', url, payload: { status: 'Unknown' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url, payload: { scores: { nope: 4 } } })).json().message).toBe('Unknown ISTQB item ids');
    expect((await app.inject({ method: 'PUT', url: '/api/v1/quality/istqb/assessments/99', payload: { comments: 'x' } })).statusCode).toBe(404);
    const updated = (await app.inject({ method: 'PUT', url, payload: { scores: allScores(5), status: 'Completed' } })).json();
    expect(updated).toMatchObject({ globalScore: 5, status: 'Completed' });
  });

  it('a partial update leaves the fields it does not send untouched', async () => {
    await post(body('ms-identity', 2, { status: 'Completed' }));
    const url = '/api/v1/quality/istqb/assessments/1';
    const updated = (await app.inject({ method: 'PUT', url, payload: { comments: 'reviewed' } })).json();
    expect(updated).toMatchObject({ comments: 'reviewed', status: 'Completed' });
  });

  it('soft deletes an assessment', async () => {
    await post(body('ms-identity', 3));
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/quality/istqb/assessments/1' })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/quality/istqb/assessments/1' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/quality/istqb/assessments/abc' })).statusCode).toBe(404);
  });

  it('summarises a service with its average and quality level', async () => {
    const empty = (await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/services/ms-x/summary' })).json();
    expect(empty).toMatchObject({ evaluations: 0, averageScore: null, level: null });
    await post(body('ms-identity', 5));
    await post(body('ms-identity', 4));
    const summary = (await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/services/ms-identity/summary' })).json();
    expect(summary).toMatchObject({ evaluations: 2, averageScore: 4.5, averagePercentage: 90, level: 'Excelente' });
    expect(Object.keys(summary.byCategory).length).toBeGreaterThan(0);
  });

  it.each([[1, 'Deficiente'], [2, 'En proceso'], [3, 'Aceptable'], [4, 'Bueno']])('average %i is "%s"', async (value, level) => {
    await post(body('svc', value));
    expect((await app.inject({ method: 'GET', url: '/api/v1/quality/istqb/services/svc/summary' })).json().level).toBe(level);
  });
});
