import Fastify, { type FastifyInstance } from 'fastify';
import { registerProcessRoutes } from '../infrastructure/http/process.routes';
import { ISO29110_PROCESSES } from '../domain/iso29110';
import type { ProcessAssessment, QualityProject } from '../domain/entities/QualityProject';
import type {
  IProcessAssessmentRepository,
  ProcessAssessmentFilter,
  ProcessAssessmentInput,
  ProcessAssessmentPatch,
} from '../domain/ports/out/IProcessAssessmentRepository';
import type {
  IQualityProjectRepository,
  QualityProjectFilter,
  QualityProjectInput,
  QualityProjectPatch,
} from '../domain/ports/out/IQualityProjectRepository';
import type { ListPage, PagedResult } from '../domain/ports/out/Paging';

class FakeProjectRepository implements IQualityProjectRepository {
  private rows: QualityProject[] = [];
  private nextId = 1;

  async create(input: QualityProjectInput): Promise<QualityProject> {
    const row = {
      ...input,
      projectId: this.nextId++,
      createdAt: 'x',
      updatedAt: 'x',
      deletedAt: null,
    } as QualityProject;
    this.rows.push(row);
    return row;
  }
  async findById(id: number): Promise<QualityProject | null> {
    return this.rows.find((r) => r.projectId === id) ?? null;
  }
  async list(filter: QualityProjectFilter, page: ListPage): Promise<PagedResult<QualityProject>> {
    const filtered = this.rows.filter((r) => !filter.status || r.status === filter.status);
    return { data: filtered.slice(page.offset, page.offset + page.limit), total: filtered.length };
  }
  async update(id: number, patch: QualityProjectPatch): Promise<QualityProject | null> {
    const idx = this.rows.findIndex((r) => r.projectId === id);
    if (idx === -1) return null;
    this.rows[idx] = { ...this.rows[idx], ...patch } as QualityProject;
    return this.rows[idx];
  }
  async softDelete(id: number): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.projectId === id);
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }
}

class FakeAssessmentRepository implements IProcessAssessmentRepository {
  private rows: ProcessAssessment[] = [];
  private nextId = 1;

  async create(input: ProcessAssessmentInput): Promise<ProcessAssessment> {
    const row = {
      ...input,
      assessmentId: this.nextId++,
      createdAt: 'x',
      updatedAt: 'x',
      deletedAt: null,
    } as ProcessAssessment;
    this.rows.push(row);
    return row;
  }
  async findById(id: number): Promise<ProcessAssessment | null> {
    return this.rows.find((r) => r.assessmentId === id) ?? null;
  }
  async list(filter: ProcessAssessmentFilter, page: ListPage): Promise<PagedResult<ProcessAssessment>> {
    const filtered = this.rows.filter(
      (r) => (filter.projectId === undefined || r.projectId === filter.projectId) && (!filter.processId || r.processId === filter.processId),
    );
    return { data: filtered.slice(page.offset, page.offset + page.limit), total: filtered.length };
  }
  async update(id: number, patch: ProcessAssessmentPatch): Promise<ProcessAssessment | null> {
    const idx = this.rows.findIndex((r) => r.assessmentId === id);
    if (idx === -1) return null;
    this.rows[idx] = { ...this.rows[idx], ...patch } as ProcessAssessment;
    return this.rows[idx];
  }
  async softDelete(id: number): Promise<boolean> {
    const idx = this.rows.findIndex((r) => r.assessmentId === id);
    if (idx === -1) return false;
    this.rows.splice(idx, 1);
    return true;
  }
}

function fullRatings(processId: 'PM' | 'SI', rating: 'N' | 'P' | 'L' | 'F'): Record<string, string> {
  const proc = ISO29110_PROCESSES.find((p) => p.id === processId)!;
  return Object.fromEntries(proc.objectives.map((o) => [o.id, rating]));
}

describe('registerProcessRoutes', () => {
  let app: FastifyInstance;
  let projects: FakeProjectRepository;
  let assessments: FakeAssessmentRepository;
  let projectId: number;

  beforeEach(async () => {
    app = Fastify();
    projects = new FakeProjectRepository();
    assessments = new FakeAssessmentRepository();
    await registerProcessRoutes(app, projects, assessments);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/projects',
      payload: { name: 'FaceAttend Edu' },
    });
    projectId = created.json().projectId;
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an assessment for a projectId that does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/assessments',
      payload: { projectId: 9999, processId: 'PM', assessor: 'a', ratings: fullRatings('PM', 'F') },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Unknown projectId');
  });

  it('rejects ratings whose objective id belongs to a different process than declared', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/assessments',
      payload: { projectId, processId: 'PM', assessor: 'a', ratings: { 'SI.O1': 'F' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Ratings must belong to process PM');
  });

  it('rejects a payload missing some of the required objectives for the process', async () => {
    const proc = ISO29110_PROCESSES.find((p) => p.id === 'PM')!;
    const partial = Object.fromEntries([[proc.objectives[0].id, 'F']]);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/assessments',
      payload: { projectId, processId: 'PM', assessor: 'a', ratings: partial },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/objectives of PM are required/);
  });

  it('creates an assessment and derives score=100/rating=F for an all-F rating set', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/assessments',
      payload: { projectId, processId: 'PM', assessor: 'a', ratings: fullRatings('PM', 'F') },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.score).toBe(100);
    expect(body.rating).toBe('F');
  });

  it('derives score=0/rating=N for an all-N rating set', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/assessments',
      payload: { projectId, processId: 'SI', assessor: 'a', ratings: fullRatings('SI', 'N') },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.score).toBe(0);
    expect(body.rating).toBe('N');
  });

  it('recomputes score/rating on PUT after merging the patch with the stored assessment', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/assessments',
      payload: { projectId, processId: 'PM', assessor: 'a', ratings: fullRatings('PM', 'N') },
    });
    const id = created.json().assessmentId;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/quality/assessments/${id}`,
      payload: { ratings: fullRatings('PM', 'F') },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().score).toBe(100);
    expect(res.json().rating).toBe('F');
  });

  it('rejects a PUT that points ratings at a projectId that does not exist', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/quality/assessments',
      payload: { projectId, processId: 'PM', assessor: 'a', ratings: fullRatings('PM', 'L') },
    });
    const id = created.json().assessmentId;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/v1/quality/assessments/${id}`,
      payload: { projectId: 424242 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toBe('Unknown projectId');
  });

  describe('GET /projects/:id/summary', () => {
    it('returns 404 for a project that does not exist', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/quality/projects/9999/summary' });
      expect(res.statusCode).toBe(404);
    });

    it('reports readiness as not ready while any process is at or below the 50% threshold', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/quality/assessments',
        payload: { projectId, processId: 'PM', assessor: 'a', ratings: fullRatings('PM', 'P') }, // 33.3%
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/quality/assessments',
        payload: { projectId, processId: 'SI', assessor: 'a', ratings: fullRatings('SI', 'F') }, // 100%
      });

      const res = await app.inject({ method: 'GET', url: `/api/v1/quality/projects/${projectId}/summary` });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.byProcess.PM.score).toBeCloseTo(33.3, 1);
      expect(body.byProcess.SI.score).toBe(100);
      expect(body.ready).toBe(false);
    });

    it('reports readiness as ready once every assessed process exceeds 50%', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/quality/assessments',
        payload: { projectId, processId: 'PM', assessor: 'a', ratings: fullRatings('PM', 'F') },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/quality/assessments',
        payload: { projectId, processId: 'SI', assessor: 'a', ratings: fullRatings('SI', 'L') },
      });

      const res = await app.inject({ method: 'GET', url: `/api/v1/quality/projects/${projectId}/summary` });
      expect(res.json().ready).toBe(true);
    });
  });
});
