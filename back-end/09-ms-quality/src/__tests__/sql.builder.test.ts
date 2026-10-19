import { buildAndFilters, buildSetClause, recordToArrays } from '../infrastructure/persistence/pg/sql.builder';

describe('buildSetClause', () => {
  const COLUMNS = {
    name: 'project_name',
    description: 'description',
    status: 'project_status',
  } as const;

  it('emits assignments only for whitelisted fields present in the patch', () => {
    const result = buildSetClause(COLUMNS, { name: 'Edge case', status: 'Active' });
    expect(result.sql).toBe('project_name = $2, project_status = $3');
    expect(result.values).toEqual(['Edge case', 'Active']);
  });

  it('iterates the whitelist, not the patch, so the generated SQL is deterministic regardless of key order', () => {
    const result = buildSetClause(COLUMNS, { status: 'Active', name: 'Edge case' });
    // Same order as COLUMNS (name, description, status), not insertion order of the patch.
    expect(result.sql).toBe('project_name = $2, project_status = $3');
  });

  it('skips keys that are absent from the patch', () => {
    const result = buildSetClause(COLUMNS, { name: 'Only name' });
    expect(result.sql).toBe('project_name = $2');
    expect(result.values).toEqual(['Only name']);
  });

  it('skips keys whose value is explicitly undefined, distinguishing "not sent" from "clear it"', () => {
    const result = buildSetClause(COLUMNS, { name: 'Kept', description: undefined });
    expect(result.sql).toBe('project_name = $2');
    expect(result.values).toEqual(['Kept']);
  });

  it('does NOT skip a value of null (null is a legitimate "clear this column" patch)', () => {
    const result = buildSetClause(COLUMNS, { description: null });
    expect(result.sql).toBe('description = $2');
    expect(result.values).toEqual([null]);
  });

  it('returns an empty sql fragment and no values for an empty patch', () => {
    const result = buildSetClause(COLUMNS, {});
    expect(result.sql).toBe('');
    expect(result.values).toEqual([]);
  });

  it('respects a custom firstParamIndex', () => {
    const result = buildSetClause(COLUMNS, { name: 'X' }, 5);
    expect(result.sql).toBe('project_name = $5');
  });

  it('numbers placeholders sequentially across multiple matched fields', () => {
    const result = buildSetClause(COLUMNS, { name: 'A', description: 'B', status: 'Planned' }, 2);
    expect(result.sql).toBe('project_name = $2, description = $3, project_status = $4');
    expect(result.values).toEqual(['A', 'B', 'Planned']);
  });
});

describe('buildAndFilters', () => {
  it('builds an AND-joined fragment for active filters', () => {
    const result = buildAndFilters([
      { column: 'service_name', value: '01-ms-identity' },
      { column: 'evaluation_status', value: 'Completed' },
    ]);
    expect(result.sql).toBe(' AND service_name = $1 AND evaluation_status = $2');
    expect(result.values).toEqual(['01-ms-identity', 'Completed']);
  });

  it('disables a filter whose value is undefined, null, or empty string', () => {
    const result = buildAndFilters([
      { column: 'service_name', value: undefined },
      { column: 'evaluation_status', value: null },
      { column: 'scope', value: '' },
    ]);
    expect(result.sql).toBe('');
    expect(result.values).toEqual([]);
  });

  it('keeps the zero value 0 as an active filter (falsy but valid)', () => {
    const result = buildAndFilters([{ column: 'project_id', value: 0 }]);
    expect(result.sql).toBe(' AND project_id = $1');
    expect(result.values).toEqual([0]);
  });

  it('mixes active and inactive filters, numbering placeholders only for active ones', () => {
    const result = buildAndFilters([
      { column: 'project_id', value: undefined },
      { column: 'process_code', value: 'PM' },
    ]);
    expect(result.sql).toBe(' AND process_code = $1');
    expect(result.values).toEqual(['PM']);
  });

  it('returns an empty fragment when every condition is disabled', () => {
    const result = buildAndFilters([]);
    expect(result.sql).toBe('');
    expect(result.values).toEqual([]);
  });

  it('respects a custom startIndex for placeholder numbering', () => {
    const result = buildAndFilters([{ column: 'project_id', value: 7 }], 3);
    expect(result.sql).toBe(' AND project_id = $3');
  });
});

describe('recordToArrays', () => {
  it('splits a record into aligned codes/values arrays in the same order', () => {
    const { codes, values } = recordToArrays({ 'tech-bva': 4, 'tech-ep': 5 });
    expect(codes).toEqual(['tech-bva', 'tech-ep']);
    expect(values).toEqual([4, 5]);
    codes.forEach((code, i) => {
      expect(values[i]).toBe({ 'tech-bva': 4, 'tech-ep': 5 }[code]);
    });
  });

  it('returns two empty arrays for an empty record', () => {
    const { codes, values } = recordToArrays({});
    expect(codes).toEqual([]);
    expect(values).toEqual([]);
  });
});
