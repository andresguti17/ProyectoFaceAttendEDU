/**
 * PostgreSQL repositories with the database helpers replaced by a recorder: every
 * statement must be parameterised (values only in params, never in the SQL text),
 * soft-deleted rows excluded, filters and paging bound as parameters, rows mapped
 * to entities, and child items written in the same transaction.
 */
type Call = { sql: string; params: unknown[]; inTransaction: boolean };
const mockCalls: Call[] = [];
let mockRoute: (sql: string, params: unknown[]) => unknown[] = () => [];

jest.mock('../infrastructure/db/database', () => ({
  runQuery: (sql: string, params: unknown[] = []) => {
    mockCalls.push({ sql, params, inTransaction: false });
    return Promise.resolve(mockRoute(sql, params));
  },
  runQueryWith: (_client: unknown, sql: string, params: unknown[] = []) => {
    mockCalls.push({ sql, params, inTransaction: true });
    return Promise.resolve(mockRoute(sql, params));
  },
  withTransaction: (fn: (client: unknown) => Promise<unknown>) => fn({}),
}));

import { PgIstqbAssessmentRepository } from '../infrastructure/persistence/pg/istqb-assessment.pg.repository';
import { PgQualityEvaluationRepository } from '../infrastructure/persistence/pg/quality-evaluation.pg.repository';
import { PgProcessAssessmentRepository } from '../infrastructure/persistence/pg/process-assessment.pg.repository';
import { PgQualityProjectRepository } from '../infrastructure/persistence/pg/quality-project.pg.repository';

const AUDIT = { created_at: '2026-10-01 10:00:00', updated_at: '2026-10-02 11:00:00', deleted_at: null };

interface Spec {
  name: string;
  repo: () => any;
  table: string;
  idColumn: string;
  idKey: string;
  row: (id: number) => Record<string, unknown>;
  input: Record<string, any>;
  firstParam: unknown;
  patch: Record<string, unknown>;
  patchColumn: string;
  filter: Record<string, unknown>;
  filterValues: unknown[];
  items?: { table: string; key: 'scores' | 'ratings'; code: string; raw: unknown; value: unknown };
}

const SPECS: Spec[] = [
  {
    name: 'ISTQB assessment',
    repo: () => new PgIstqbAssessmentRepository(),
    table: 'quality.istqb_assessment',
    idColumn: 'istqb_assessment_id',
    idKey: 'assessmentId',
    row: (id) => ({ istqb_assessment_id: id, service_name: 'ms-identity', evaluator_name: 'QA', assessment_scope: 'API', project_id: 3, assessment_status: 'Draft', comments: null, global_score: 4.2, percentage: 84, quality_level: 'Bueno', ...AUDIT }),
    input: { service: 'ms-identity', evaluator: 'QA', scope: 'API', status: 'Draft', scores: { 'tech-bva': 4 } },
    firstParam: 'ms-identity',
    patch: { status: 'Completed' },
    patchColumn: 'assessment_status',
    filter: { service: 'ms-identity', status: 'Completed' },
    filterValues: ['ms-identity', 'Completed'],
    items: { table: 'quality.istqb_assessment_item', key: 'scores', code: 'tech-bva', raw: '4', value: 4 },
  },
  {
    name: 'ISO 25010 evaluation',
    repo: () => new PgQualityEvaluationRepository(),
    table: 'quality.quality_evaluation',
    idColumn: 'evaluation_id',
    idKey: 'evaluationId',
    row: (id) => ({ evaluation_id: id, service_name: 'ms-academic', evaluator_name: 'QA', evaluation_scope: 'Web', project_id: null, evaluation_status: 'Draft', comments: 'ok', global_score: null, percentage: null, quality_level: null, ...AUDIT }),
    input: { service: 'ms-academic', evaluator: 'QA', scope: 'Web', status: 'Draft', scores: { 'FS-1': 5 } },
    firstParam: 'ms-academic',
    patch: { comments: 'revisado' },
    patchColumn: 'comments',
    filter: { service: 'ms-academic' },
    filterValues: ['ms-academic'],
    items: { table: 'quality.quality_evaluation_item', key: 'scores', code: 'FS-1', raw: '5', value: 5 },
  },
  {
    name: 'ISO 29110 process assessment',
    repo: () => new PgProcessAssessmentRepository(),
    table: 'quality.process_assessment',
    idColumn: 'assessment_id',
    idKey: 'assessmentId',
    row: (id) => ({ assessment_id: id, project_id: 1, process_code: 'PM', assessor_name: 'QA', assessment_status: 'Draft', comments: null, process_score: 80, process_rating: 'L', ...AUDIT }),
    input: { projectId: 1, processId: 'PM', assessor: 'QA', status: 'Draft', ratings: { 'PM.O1': 'F' } },
    firstParam: 1,
    patch: { assessor: 'Auditor' },
    patchColumn: 'assessor_name',
    filter: { projectId: 1 },
    filterValues: [1],
    items: { table: 'quality.process_assessment_rating', key: 'ratings', code: 'PM.O1', raw: 'F', value: 'F' },
  },
  {
    name: 'quality project',
    repo: () => new PgQualityProjectRepository(),
    table: 'quality.quality_project',
    idColumn: 'project_id',
    idKey: 'projectId',
    row: (id) => ({ project_id: id, project_name: 'FaceAttend', description: null, customer: 'SENA', planned_start_on: '2026-01-15', planned_end_on: null, project_status: 'Active', ...AUDIT }),
    input: { name: 'FaceAttend', customer: 'SENA', status: 'Active' },
    firstParam: 'FaceAttend',
    patch: { status: 'Closed' },
    patchColumn: 'project_status',
    filter: { status: 'Active' },
    filterValues: ['Active'],
  },
];

beforeEach(() => {
  mockCalls.length = 0;
  mockRoute = () => [];
});

const isMain = (sql: string, spec: Spec) => new RegExp(`(INTO|FROM|UPDATE)\\s+${spec.table.replace('.', '\\.')}\\b(?!_)`).test(sql);

describe.each(SPECS)('$name repository', (spec) => {
  it('creates the row with bound parameters and its child items in the same transaction', async () => {
    mockRoute = (sql) => (sql.includes(`INSERT INTO ${spec.table}`) && isMain(sql, spec) ? [spec.row(7)] : []);
    const created = await spec.repo().create(spec.input);
    expect(created[spec.idKey]).toBe(7);
    expect(created.createdAt).toBe('2026-10-01T10:00:00.000Z');
    const insert = mockCalls[0];
    expect(insert.sql).toMatch(/VALUES \(\$1/);
    expect(insert.params[0]).toEqual(spec.firstParam);
    for (const p of insert.params) if (typeof p === 'string') expect(insert.sql).not.toContain(p);
    if (spec.items) {
      expect(created[spec.items.key]).toEqual(spec.input[spec.items.key]);
      const itemWrite = mockCalls.find((c) => c.sql.includes(`INSERT INTO ${spec.items!.table}`));
      expect(itemWrite).toMatchObject({ inTransaction: true, params: [7, [spec.items.code], [spec.items.value]] });
    }
  });

  it('finds a live row by id and maps it; a missing one is null', async () => {
    expect(await spec.repo().findById(9)).toBeNull();
    expect(mockCalls[0].sql).toContain('deleted_at IS NULL');
    expect(mockCalls[0].params).toEqual([9]);

    mockCalls.length = 0;
    mockRoute = (sql) => {
      if (spec.items && sql.includes('AS parent_id')) return [{ parent_id: 9, code: spec.items.code, value: spec.items.raw }];
      return isMain(sql, spec) ? [spec.row(9)] : [];
    };
    const found = await spec.repo().findById(9);
    expect(found[spec.idKey]).toBe(9);
    expect(found.deletedAt).toBeNull();
    if (spec.items) expect(found[spec.items.key]).toEqual({ [spec.items.code]: spec.items.value });
  });

  it('lists with filters and paging bound as parameters', async () => {
    mockRoute = (sql) => {
      if (sql.includes('count(*)')) return [{ total: 2 }];
      if (spec.items && sql.includes('AS parent_id')) return [];
      return isMain(sql, spec) ? [spec.row(1), spec.row(2)] : [];
    };
    const page = await spec.repo().list(spec.filter, { limit: 10, offset: 20 });
    expect(page.total).toBe(2);
    expect(page.data.map((e: any) => e[spec.idKey])).toEqual([1, 2]);
    const [count, select] = mockCalls;
    expect(count.params).toEqual(spec.filterValues);
    expect(select.params).toEqual([...spec.filterValues, 10, 20]);
    expect(select.sql).toMatch(/LIMIT \$\d+ OFFSET \$\d+/);
    expect(select.sql).toContain('deleted_at IS NULL');
  });

  it('an empty page still reports the total', async () => {
    mockRoute = (sql) => (sql.includes('count(*)') ? [{ total: 0 }] : []);
    expect(await spec.repo().list({}, { limit: 5, offset: 0 })).toEqual({ data: [], total: 0 });
  });

  it('updates only whitelisted columns, and a missing row is null', async () => {
    mockRoute = (sql) => (isMain(sql, spec) && sql.includes('UPDATE') ? [{ ...spec.row(4), [spec.patchColumn]: Object.values(spec.patch)[0] }] : []);
    const updated = await spec.repo().update(4, { ...spec.patch, notAColumn: 'x' });
    expect(updated[spec.idKey]).toBe(4);
    const statement = mockCalls.find((c) => c.sql.includes(`UPDATE ${spec.table}`))!;
    expect(statement.sql).toContain(spec.patchColumn);
    expect(statement.sql).not.toContain('notAColumn');
    expect(statement.params).toEqual([4, Object.values(spec.patch)[0]]);

    mockCalls.length = 0;
    mockRoute = () => [];
    expect(await spec.repo().update(4, spec.patch)).toBeNull();
  });

  if (spec.items) {
    it('an update without column changes locks the row and keeps its items', async () => {
      mockRoute = (sql) => {
        if (sql.includes('AS parent_id')) return [{ parent_id: 4, code: spec.items!.code, value: spec.items!.raw }];
        return isMain(sql, spec) ? [spec.row(4)] : [];
      };
      const same = await spec.repo().update(4, {});
      expect(mockCalls[0].sql).toContain('FOR UPDATE');
      expect(same[spec.items!.key]).toEqual({ [spec.items!.code]: spec.items!.value });
    });

    it('an update with new items rewrites them in the transaction', async () => {
      mockRoute = (sql) => (isMain(sql, spec) ? [spec.row(4)] : []);
      const next = spec.input[spec.items!.key];
      const updated = await spec.repo().update(4, { [spec.items!.key]: next });
      expect(updated[spec.items!.key]).toEqual(next);
      expect(mockCalls.some((c) => c.sql.includes(`INSERT INTO ${spec.items!.table}`) && c.inTransaction)).toBe(true);
    });
  }

  it('soft deletes only a live row', async () => {
    mockRoute = () => [{ [spec.idColumn]: 5 }];
    expect(await spec.repo().softDelete(5)).toBe(true);
    expect(mockCalls[0].sql).toContain('SET deleted_at = CURRENT_TIMESTAMP');
    expect(mockCalls[0].params).toEqual([5]);
    mockRoute = () => [];
    expect(await spec.repo().softDelete(5)).toBe(false);
  });
});
