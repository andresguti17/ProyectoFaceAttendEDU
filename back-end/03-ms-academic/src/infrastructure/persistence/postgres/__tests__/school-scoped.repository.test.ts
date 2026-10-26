/**
 * Cohorts, courses and enrollments of one school: a single query each, with the school
 * resolved in a subquery and LIMIT/OFFSET in SQL. Before, the routes fetched one list per
 * program (or per cohort) and sliced in memory, and the count re-ran all of it.
 * `runQuery` is mocked; assertions check the SQL and bind parameters.
 */
import { PostgresCohortRepository } from '../cohort.repository';
import { PostgresCourseRepository } from '../course.repository';
import { PostgresEnrollmentRepository } from '../enrollment.repository';

jest.mock('../../../db/database', () => ({
  runQuery: jest.fn(),
  runCommand: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const database = require('../../../db/database');
const mockRunQuery = database.runQuery as jest.MockedFunction<
  (sql: string, params?: readonly unknown[]) => Promise<unknown[]>
>;

describe('school-scoped listing', () => {
  beforeEach(() => mockRunQuery.mockReset());

  it.each([
    ['cohorts', () => new PostgresCohortRepository(), /academic\.cohort WHERE .*program_id IN \(SELECT program_id FROM academic\.program WHERE school_id = \$1/],
    ['courses', () => new PostgresCourseRepository(), /academic\.course WHERE .*program_id IN \(SELECT program_id FROM academic\.program WHERE school_id = \$1/],
    ['enrollments', () => new PostgresEnrollmentRepository(), /academic\.enrollment WHERE .*cohort_id IN \(SELECT c\.cohort_id FROM academic\.cohort c JOIN academic\.program p/],
  ])('pages the %s of a school in one query', async (_name, repo, scope) => {
    mockRunQuery.mockResolvedValueOnce([]);

    await repo().findBySchool(7, { limit: 20, offset: 40 });

    const [sql, params] = mockRunQuery.mock.calls[0];
    expect(sql).toMatch(scope);
    expect(sql).toMatch(/deleted_at IS NULL/);
    expect(sql).toMatch(/LIMIT \$2 OFFSET \$3$/);
    expect(params).toEqual([7, 20, 40]);
    expect(mockRunQuery).toHaveBeenCalledTimes(1);
  });

  it('lists without paging when no page is asked for', async () => {
    mockRunQuery.mockResolvedValueOnce([]);
    await new PostgresCohortRepository().findBySchool(7);
    const [sql, params] = mockRunQuery.mock.calls[0];
    expect(sql).not.toMatch(/LIMIT|OFFSET/);
    expect(params).toEqual([7]);
  });

  it('counts the same rows with a single COUNT', async () => {
    mockRunQuery.mockResolvedValueOnce([{ total: 12 }]);
    await expect(new PostgresEnrollmentRepository().countBySchool(7)).resolves.toBe(12);
    const [sql, params] = mockRunQuery.mock.calls[0];
    expect(sql).toMatch(/^SELECT COUNT\(\*\)::int AS total FROM academic\.enrollment WHERE deleted_at IS NULL AND cohort_id IN/);
    expect(params).toEqual([7]);
  });
});
