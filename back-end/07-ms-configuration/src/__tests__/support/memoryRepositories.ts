/**
 * In-memory configuration repositories with the same filters as the PostgreSQL
 * adapters (exact name, school, status, person or person set; opt-in paging).
 */
import type { ConfigurationRepositories } from '../../infrastructure/persistence/postgres';

type Row = Record<string, any>;
type Query = { name?: string; schoolId?: number; status?: string; personId?: string; personIds?: readonly string[]; limit?: number; offset?: number };

class MemoryRepo {
  readonly rows = new Map<string | number, Row>();
  private seq = 1;

  constructor(private readonly idField: string, private readonly nameField = 'configurationName') {}

  private matches(row: Row, q: Query): boolean {
    if (row.deletedAt) return false;
    if (q.name !== undefined && row[this.nameField] !== q.name) return false;
    if (q.schoolId !== undefined && row.schoolId !== q.schoolId) return false;
    if (q.status !== undefined && row.updateStatus !== q.status) return false;
    if (q.personId !== undefined && row.personId !== q.personId) return false;
    if (q.personIds !== undefined && !q.personIds.includes(row.personId)) return false;
    return true;
  }

  async search(q: Query = {}) {
    const all = [...this.rows.values()].filter((r) => this.matches(r, q)).map((r) => ({ ...r }));
    if (q.limit === undefined && q.offset === undefined) return all;
    const offset = q.offset ?? 0;
    return all.slice(offset, offset + (q.limit ?? all.length));
  }

  async countMatching(q: Query = {}) {
    return [...this.rows.values()].filter((r) => this.matches(r, q)).length;
  }

  async findById(id: string | number) {
    const row = this.rows.get(id);
    return row && !row.deletedAt ? { ...row } : null;
  }

  async create(draft: Row) {
    const id = draft[this.idField] ?? this.seq++;
    const row = { ...draft, [this.idField]: id, createdAt: '2026-10-01T00:00:00.000Z', deletedAt: null };
    this.rows.set(id, row);
    return { ...row };
  }

  async update(id: string | number, patch: Row) {
    const row = this.rows.get(id);
    if (!row || row.deletedAt) return null;
    Object.assign(row, patch);
    return { ...row };
  }

  async softDelete(id: string | number) {
    const row = this.rows.get(id);
    if (!row || row.deletedAt) return false;
    row.deletedAt = '2026-10-03T00:00:00.000Z';
    return true;
  }
}

export function memoryRepositories() {
  const repos = {
    academic: new MemoryRepo('configurationId'),
    security: new MemoryRepo('configurationId'),
    cases: new MemoryRepo('caseId'),
  };
  return repos as unknown as ConfigurationRepositories & typeof repos;
}
