// Generic in-memory CRUD store with soft-delete (deletedAt) to match 06-data conventions.
// Keeps the service runnable without Postgres for basic CRUD via gateway.

export function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryStore<T extends Record<string, unknown>> {
  private items = new Map<number, T>();
  private seq = 1;
  constructor(private readonly idField: string) {}

  create(data: Omit<T, string> & Record<string, unknown>): T {
    const id = this.seq++;
    const now = nowIso();
    const record = {
      [this.idField]: id,
      ...data,
      createdAt: (data as Record<string, unknown>)['createdAt'] ?? now,
      updatedAt: now,
      deletedAt: null,
    } as unknown as T;
    this.items.set(id, record);
    return record;
  }

  list(filter?: (r: T) => boolean): T[] {
    const out: T[] = [];
    for (const r of this.items.values()) {
      if ((r as Record<string, unknown>)['deletedAt'] !== null && (r as Record<string, unknown>)['deletedAt'] !== undefined) continue;
      if (filter && !filter(r)) continue;
      out.push(r);
    }
    return out;
  }

  get(id: number): T | null {
    const r = this.items.get(id) ?? null;
    if (!r) return null;
    if ((r as Record<string, unknown>)['deletedAt']) return null;
    return r;
  }

  update(id: number, patch: Partial<T>): T | null {
    const current = this.items.get(id);
    if (!current || (current as Record<string, unknown>)['deletedAt']) return null;
    const updated = { ...current, ...patch, updatedAt: nowIso() } as T;
    (updated as Record<string, unknown>)[this.idField] = id;
    this.items.set(id, updated);
    return updated;
  }

  remove(id: number): boolean {
    const current = this.items.get(id);
    if (!current || (current as Record<string, unknown>)['deletedAt']) return false;
    (current as Record<string, unknown>)['deletedAt'] = nowIso();
    (current as Record<string, unknown>)['updatedAt'] = nowIso();
    return true;
  }
}
