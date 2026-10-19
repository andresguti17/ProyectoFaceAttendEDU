/**
 * Tests for `PostgresCrudRepository`, the OWASP-A03 injection-safety boundary
 * every concrete repository in this service extends (see crud.repository.ts).
 *
 * `runQuery`/`runCommand` are mocked so nothing here touches a real Postgres
 * connection; assertions check the exact SQL string and bind-param array the
 * base class hands to the driver layer.
 *
 * The class under test is abstract, so it is exercised through two minimal
 * concrete subclasses declared below (`TestRepository`, with a numeric PK and
 * a mix of writable/non-writable/cast fields; `UuidPkTestRepository`, to cover
 * the `primaryKeyCast` path used by the real `biometric_update_case` table).
 */

import {
  PostgresCrudRepository,
  dateParam,
  intToText,
  numberParam,
  toInt,
  type FieldSpec,
} from '../crud.repository';
import { RepositoryError } from '../../errors';

jest.mock('../../../db/database', () => ({
  runQuery: jest.fn(),
  runCommand: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const database = require('../../../db/database');
const mockRunQuery = database.runQuery as jest.MockedFunction<
  (sql: string, params?: readonly unknown[]) => Promise<unknown[]>
>;
const mockRunCommand = database.runCommand as jest.MockedFunction<
  (sql: string, params?: readonly unknown[]) => Promise<number>
>;

interface TestEntity {
  id: number;
  name: string;
  status: string;
  updatedAt: string;
}

class TestRepository extends PostgresCrudRepository<TestEntity> {
  protected readonly qualifiedTable = 'test_schema.test_entity';
  protected readonly primaryKeyColumn = 'id';
  protected readonly primaryKeyField = 'id';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'id', column: 'id', writable: false },
    { field: 'name', column: 'name' },
    { field: 'status', column: 'status', cast: 'test_schema.status_enum' },
    { field: 'updatedAt', column: 'updated_at', writable: false },
  ];

  /** Test-only hole into the protected whitelist guard. */
  exposeColumnOf(field: string): string {
    return this.columnOf(field);
  }
}

class UuidPkTestRepository extends PostgresCrudRepository<{ id: string; name: string }> {
  protected readonly qualifiedTable = 'test_schema.uuid_entity';
  protected readonly primaryKeyColumn = 'id';
  protected readonly primaryKeyField = 'id';
  protected readonly primaryKeyCast = 'uuid';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'id', column: 'id' },
    { field: 'name', column: 'name' },
  ];
}

const SELECT_COLUMNS = 'id, name, status, updated_at';

describe('PostgresCrudRepository', () => {
  let repo: TestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TestRepository();
  });

  describe('columnOf (whitelist guard)', () => {
    it('resolves a mapped field to its column', () => {
      expect(repo.exposeColumnOf('name')).toBe('name');
    });

    it('throws for an unmapped field name instead of letting it reach SQL', () => {
      expect(() => repo.exposeColumnOf('doesNotExist')).toThrow(/unmapped field 'doesNotExist'/i);
    });
  });

  describe('create()', () => {
    it('writes only writable fields present in the input, appends the declared cast, and never writes audit/PK columns', async () => {
      mockRunQuery.mockResolvedValueOnce([
        { id: 1, name: 'Alice', status: 'ACTIVE', updated_at: '2024-01-01T00:00:00.000Z' },
      ]);

      const result = await repo.create({
        id: 999, // writable: false -> must be ignored
        name: 'Alice',
        status: 'ACTIVE',
        updatedAt: 'ignored-client-value', // writable: false -> must be ignored
      });

      expect(mockRunQuery).toHaveBeenCalledTimes(1);
      expect(mockRunQuery).toHaveBeenCalledWith(
        `INSERT INTO test_schema.test_entity (name, status) VALUES ($1, $2::test_schema.status_enum) RETURNING ${SELECT_COLUMNS}`,
        ['Alice', 'ACTIVE'],
      );
      expect(result).toEqual({ id: 1, name: 'Alice', status: 'ACTIVE', updatedAt: '2024-01-01T00:00:00.000Z' });
    });

    it('skips a writable field whose value is undefined', async () => {
      mockRunQuery.mockResolvedValueOnce([{ id: 1, name: null, status: 'ACTIVE', updated_at: null }]);

      await repo.create({ name: undefined, status: 'ACTIVE' });

      expect(mockRunQuery).toHaveBeenCalledWith(
        `INSERT INTO test_schema.test_entity (status) VALUES ($1::test_schema.status_enum) RETURNING ${SELECT_COLUMNS}`,
        ['ACTIVE'],
      );
    });

    it('throws a 400 RepositoryError and never queries when zero writable fields are supplied', async () => {
      await expect(repo.create({ id: 5, updatedAt: 'x' })).rejects.toMatchObject({
        statusCode: 400,
        errorCode: 'BadRequest',
      });
      await expect(repo.create({})).rejects.toBeInstanceOf(RepositoryError);
      expect(mockRunQuery).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('sets only the fields present in a partial patch and always filters deleted_at IS NULL', async () => {
      mockRunQuery.mockResolvedValueOnce([
        { id: 1, name: 'Bob', status: 'ACTIVE', updated_at: '2024-01-02T00:00:00.000Z' },
      ]);

      const result = await repo.update(1, { name: 'Bob' });

      expect(mockRunQuery).toHaveBeenCalledWith(
        `UPDATE test_schema.test_entity SET name = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING ${SELECT_COLUMNS}`,
        ['Bob', 1],
      );
      expect(result).toEqual({ id: 1, name: 'Bob', status: 'ACTIVE', updatedAt: '2024-01-02T00:00:00.000Z' });
    });

    it('appends the declared cast to a patched column', async () => {
      mockRunQuery.mockResolvedValueOnce([{ id: 1, name: 'Bob', status: 'CLOSED', updated_at: null }]);

      await repo.update(1, { status: 'CLOSED' });

      expect(mockRunQuery).toHaveBeenCalledWith(
        `UPDATE test_schema.test_entity SET status = $1::test_schema.status_enum WHERE id = $2 AND deleted_at IS NULL RETURNING ${SELECT_COLUMNS}`,
        ['CLOSED', 1],
      );
    });

    it('issues a no-op SELECT instead of an UPDATE for an empty patch, and never calls runCommand', async () => {
      mockRunQuery.mockResolvedValueOnce([
        { id: 1, name: 'Alice', status: 'ACTIVE', updated_at: '2024-01-01T00:00:00.000Z' },
      ]);

      await repo.update(1, {});

      expect(mockRunQuery).toHaveBeenCalledTimes(1);
      expect(mockRunQuery).toHaveBeenCalledWith(
        `SELECT ${SELECT_COLUMNS} FROM test_schema.test_entity WHERE id = $1 AND deleted_at IS NULL`,
        [1],
      );
      expect(mockRunCommand).not.toHaveBeenCalled();
    });

    it('returns null when the row does not exist (or is soft-deleted)', async () => {
      mockRunQuery.mockResolvedValueOnce([]);
      expect(await repo.update(999, { name: 'X' })).toBeNull();
    });
  });

  describe('softDelete()', () => {
    it('stamps deleted_at and returns true when a row was affected', async () => {
      mockRunCommand.mockResolvedValueOnce(1);

      expect(await repo.softDelete(1)).toBe(true);
      expect(mockRunCommand).toHaveBeenCalledWith(
        'UPDATE test_schema.test_entity SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
        [1],
      );
    });

    it('returns false when no row matched (missing or already deleted)', async () => {
      mockRunCommand.mockResolvedValueOnce(0);
      expect(await repo.softDelete(999)).toBe(false);
    });
  });

  describe('list() / findById()', () => {
    it('list() always filters deleted_at IS NULL and omits LIMIT/OFFSET when not provided', async () => {
      mockRunQuery.mockResolvedValueOnce([]);

      await repo.list();

      expect(mockRunQuery).toHaveBeenCalledWith(
        `SELECT ${SELECT_COLUMNS} FROM test_schema.test_entity WHERE deleted_at IS NULL ORDER BY id ASC`,
        [],
      );
    });

    it('list() appends LIMIT/OFFSET placeholders and params only when supplied', async () => {
      mockRunQuery.mockResolvedValueOnce([]);

      await repo.list({ limit: 10, offset: 5 });

      expect(mockRunQuery).toHaveBeenCalledWith(
        `SELECT ${SELECT_COLUMNS} FROM test_schema.test_entity WHERE deleted_at IS NULL ORDER BY id ASC LIMIT $1 OFFSET $2`,
        [10, 5],
      );
    });

    it('list() rejects a filter column that is not in the static whitelist (defence in depth)', async () => {
      await expect(
        repo.list({ filters: [{ column: 'sql_injection_attempt', value: 1 }] }),
      ).rejects.toMatchObject({ statusCode: 500 });
      expect(mockRunQuery).not.toHaveBeenCalled();
    });

    it('findById() filters by primary key and deleted_at IS NULL, and maps the row', async () => {
      mockRunQuery.mockResolvedValueOnce([
        { id: 1, name: 'Alice', status: 'ACTIVE', updated_at: '2024-01-01T00:00:00.000Z' },
      ]);

      const result = await repo.findById(1);

      expect(mockRunQuery).toHaveBeenCalledWith(
        `SELECT ${SELECT_COLUMNS} FROM test_schema.test_entity WHERE id = $1 AND deleted_at IS NULL`,
        [1],
      );
      expect(result).toEqual({ id: 1, name: 'Alice', status: 'ACTIVE', updatedAt: '2024-01-01T00:00:00.000Z' });
    });

    it('findById() returns null when no row matches', async () => {
      mockRunQuery.mockResolvedValueOnce([]);
      expect(await repo.findById(404)).toBeNull();
    });
  });

  describe('existsById() / count()', () => {
    it('existsById() reflects the EXISTS() result', async () => {
      mockRunQuery.mockResolvedValueOnce([{ found: true }]);
      expect(await repo.existsById(1)).toBe(true);
    });

    it('count() ignores LIMIT/OFFSET and filters deleted_at IS NULL', async () => {
      mockRunQuery.mockResolvedValueOnce([{ total: 3 }]);
      const total = await repo.count();
      expect(total).toBe(3);
      expect(mockRunQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*)::int AS total FROM test_schema.test_entity WHERE deleted_at IS NULL',
        [],
      );
    });
  });

  describe('primary key cast (e.g. UUID tables like biometric_update_case)', () => {
    it('appends the declared primaryKeyCast to every PK placeholder', async () => {
      const uuidRepo = new UuidPkTestRepository();
      mockRunQuery.mockResolvedValueOnce([{ id: 'abc-123', name: 'X' }]);

      await uuidRepo.findById('abc-123');

      expect(mockRunQuery).toHaveBeenCalledWith(
        'SELECT id, name FROM test_schema.uuid_entity WHERE id = $1::uuid AND deleted_at IS NULL',
        ['abc-123'],
      );
    });
  });
});

describe('value coercion helpers', () => {
  describe('toInt', () => {
    it('passes through finite numbers and numeric strings', () => {
      expect(toInt(42)).toBe(42);
      expect(toInt('42')).toBe(42);
    });

    it('returns null for null/undefined/non-numeric input', () => {
      expect(toInt(null)).toBeNull();
      expect(toInt(undefined)).toBeNull();
      expect(toInt('not-a-number')).toBeNull();
    });
  });

  describe('intToText', () => {
    it('stringifies a number for text columns', () => {
      expect(intToText(42)).toBe('42');
    });

    it('returns null for null/undefined', () => {
      expect(intToText(null)).toBeNull();
      expect(intToText(undefined)).toBeNull();
    });
  });

  describe('dateParam', () => {
    it('truncates an ISO timestamp down to YYYY-MM-DD', () => {
      expect(dateParam('2024-01-15T10:00:00Z')).toBe('2024-01-15');
    });

    it('treats null/undefined/empty string as null', () => {
      expect(dateParam(null)).toBeNull();
      expect(dateParam(undefined)).toBeNull();
      expect(dateParam('')).toBeNull();
    });
  });

  describe('numberParam', () => {
    it('accepts finite numbers and numeric strings', () => {
      expect(numberParam(5)).toBe(5);
      expect(numberParam('5')).toBe(5);
    });

    it('rejects non-finite or non-numeric values', () => {
      expect(numberParam(NaN)).toBeNull();
      expect(numberParam('abc')).toBeNull();
      expect(numberParam(null)).toBeNull();
    });
  });
});
