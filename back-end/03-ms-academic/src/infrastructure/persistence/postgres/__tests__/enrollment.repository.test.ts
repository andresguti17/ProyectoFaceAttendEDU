/**
 * Re-enrolling after "Desmatricular": the soft-deleted row of the same
 * (actor, cohort) pair is brought back instead of hitting uq_enrollment_actor_cohort.
 * `runQuery` is mocked; assertions check the SQL and bind parameters.
 */
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

const row = {
  enrollment_id: 1702,
  academic_actor_id: 1834,
  cohort_id: 25,
  enrolled_on: '2026-10-21',
  enrollment_status: 'Active',
};
const draft = { academicActorId: 1834, cohortId: 25, enrolledOn: '2026-10-21', enrollmentStatus: 'Active' };

describe('PostgresEnrollmentRepository.createOrRestore', () => {
  beforeEach(() => mockRunQuery.mockReset());

  it('brings back the deleted enrollment of the same pair instead of inserting a duplicate', async () => {
    mockRunQuery
      .mockResolvedValueOnce([{ enrollment_id: 1702 }]) // UPDATE ... RETURNING enrollment_id
      .mockResolvedValueOnce([row]); // findById

    const record = await new PostgresEnrollmentRepository().createOrRestore(draft);

    const [updateSql, updateParams] = mockRunQuery.mock.calls[0];
    expect(updateSql).toMatch(/UPDATE academic\.enrollment/);
    expect(updateSql).toMatch(/deleted_at = NULL/);
    expect(updateSql).toMatch(/deleted_at IS NOT NULL/);
    // One row only: with partial unique indexes several deleted rows of a pair can exist, and
    // reviving them all at once would put two live enrollments on the same pair.
    expect(updateSql).toMatch(/ORDER BY enrollment_id DESC LIMIT 1/);
    expect(updateParams).toEqual([1834, 25, 'Active', '2026-10-21']);
    expect(mockRunQuery.mock.calls.some(([sql]) => /INSERT INTO/.test(sql))).toBe(false);
    expect(record.enrollmentId).toBe(1702);
  });

  it('inserts a new enrollment when the pair was never enrolled', async () => {
    mockRunQuery
      .mockResolvedValueOnce([]) // nothing to revive
      .mockResolvedValueOnce([{ ...row, enrollment_id: 2000 }]); // INSERT ... RETURNING

    const record = await new PostgresEnrollmentRepository().createOrRestore(draft);

    expect(mockRunQuery.mock.calls[1][0]).toMatch(/INSERT INTO academic\.enrollment/);
    expect(record.enrollmentId).toBe(2000);
  });
});
