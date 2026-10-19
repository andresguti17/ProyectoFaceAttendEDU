import type { PoolClient } from 'pg';

const runQuery = jest.fn();
const runQueryWith = jest.fn();

jest.mock('../infrastructure/db/database', () => ({
  runQuery: (...args: unknown[]) => runQuery(...args),
  runQueryWith: (...args: unknown[]) => runQueryWith(...args),
}));

// Imported after the mock so the module under test picks up the mocked database helpers.
import { loadItems, toNumberRecord, toStringRecord, writeItems, type ItemCollectionConfig } from '../infrastructure/persistence/pg/item-collection';

const CONFIG: ItemCollectionConfig = {
  table: 'quality.quality_evaluation_item',
  parentColumn: 'evaluation_id',
  codeColumn: 'subcharacteristic_code',
  valueColumn: 'score',
  codeArrayType: 'varchar[]',
  valueArrayType: 'smallint[]',
};

const fakeClient = {} as PoolClient;

beforeEach(() => {
  runQuery.mockReset();
  runQueryWith.mockReset();
});

describe('writeItems', () => {
  it('upserts the given entries then logically deletes codes no longer present', async () => {
    runQueryWith.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await writeItems(fakeClient, CONFIG, 42, { codes: ['tech-bva', 'tech-ep'], values: [4, 5] });

    expect(runQueryWith).toHaveBeenCalledTimes(2);

    const [, upsertSql, upsertParams] = runQueryWith.mock.calls[0];
    expect(upsertSql).toContain('INSERT INTO quality.quality_evaluation_item');
    expect(upsertSql).toContain('ON CONFLICT (evaluation_id, subcharacteristic_code)');
    expect(upsertSql).toContain('unnest($2::varchar[], $3::smallint[])');
    expect(upsertParams).toEqual([42, ['tech-bva', 'tech-ep'], [4, 5]]);

    const [, deleteSql, deleteParams] = runQueryWith.mock.calls[1];
    expect(deleteSql).toContain('UPDATE quality.quality_evaluation_item');
    expect(deleteSql).toContain('SET deleted_at = CURRENT_TIMESTAMP');
    expect(deleteSql).toContain('subcharacteristic_code <> ALL($2::varchar[])');
    expect(deleteParams).toEqual([42, ['tech-bva', 'tech-ep']]);
  });

  it('still issues both statements for an empty entries collection (clears all items for the parent)', async () => {
    runQueryWith.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await writeItems(fakeClient, CONFIG, 7, { codes: [], values: [] });

    expect(runQueryWith).toHaveBeenCalledTimes(2);
    expect(runQueryWith.mock.calls[0][2]).toEqual([7, [], []]);
    expect(runQueryWith.mock.calls[1][2]).toEqual([7, []]);
  });
});

describe('loadItems', () => {
  it('returns an empty map without querying when parentIds is empty', async () => {
    const result = await loadItems(CONFIG, []);
    expect(result.size).toBe(0);
    expect(runQuery).not.toHaveBeenCalled();
    expect(runQueryWith).not.toHaveBeenCalled();
  });

  it('groups rows by parent_id into a Record<code, value> using the pool when no client is given', async () => {
    runQuery.mockResolvedValueOnce([
      { parent_id: 1, code: 'tech-bva', value: 4 },
      { parent_id: 1, code: 'tech-ep', value: 5 },
      { parent_id: 2, code: 'tech-bva', value: 3 },
    ]);

    const result = await loadItems(CONFIG, [1, 2]);

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQueryWith).not.toHaveBeenCalled();
    expect(result.get(1)).toEqual({ 'tech-bva': 4, 'tech-ep': 5 });
    expect(result.get(2)).toEqual({ 'tech-bva': 3 });
  });

  it('uses the transaction client (runQueryWith) when one is supplied', async () => {
    runQueryWith.mockResolvedValueOnce([{ parent_id: 1, code: 'PM.O1', value: 'F' }]);

    const result = await loadItems(CONFIG, [1], fakeClient);

    expect(runQueryWith).toHaveBeenCalledTimes(1);
    expect(runQuery).not.toHaveBeenCalled();
    expect(result.get(1)).toEqual({ 'PM.O1': 'F' });
  });

  it('omits a parentId from the map entirely when it has no live rows', async () => {
    runQuery.mockResolvedValueOnce([]);
    const result = await loadItems(CONFIG, [99]);
    expect(result.has(99)).toBe(false);
  });
});

describe('toNumberRecord', () => {
  it('converts raw values to numbers', () => {
    expect(toNumberRecord({ a: '4', b: 5 })).toEqual({ a: 4, b: 5 });
  });

  it('returns {} for undefined input instead of throwing', () => {
    expect(toNumberRecord(undefined)).toEqual({});
  });
});

describe('toStringRecord', () => {
  it('converts raw values to strings', () => {
    expect(toStringRecord({ a: 1, b: 'F' })).toEqual({ a: '1', b: 'F' });
  });

  it('returns {} for undefined input instead of throwing', () => {
    expect(toStringRecord(undefined)).toEqual({});
  });
});
