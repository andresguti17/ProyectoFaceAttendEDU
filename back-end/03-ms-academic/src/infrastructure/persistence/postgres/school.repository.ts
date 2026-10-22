import type { School } from '../../../domain/entities/School';
import type { ISchoolRepository } from '../../../domain/ports/out/ISchoolRepository';
import { withTransaction } from '../../db/database';
import { RepositoryError, translateDbError } from '../errors';
import { PostgresCrudRepository, type FieldSpec, intToText, toInt } from './crud.repository';
import { AUDIT_FIELDS } from './audit.fields';

/**
 * PostgreSQL adapter for `academic.school`.
 *
 * Response key order matches what the in-memory store used to emit
 * (schoolId, code, name, cityId, cityName, address, phone, email, status,
 * audit); `cityName` is additive to the original contract.
 *
 * `city_id` is VARCHAR(100) NULL in PostgreSQL — there is deliberately no
 * cross-context FK to `identity.city` — while the API exposes `cityId` as a
 * number. Written as text, read back as a number. `city_name` carries the
 * plain-text name the forms pick from the countriesnow catalog.
 *
 * Columns `district` and `country` exist in the table but have never been
 * part of the API response, so they are neither selected nor written.
 */
export class PostgresSchoolRepository extends PostgresCrudRepository<School> implements ISchoolRepository {
  protected readonly qualifiedTable = 'academic.school';
  protected readonly primaryKeyColumn = 'school_id';
  protected readonly primaryKeyField = 'schoolId';
  protected readonly fields: readonly FieldSpec[] = [
    { field: 'schoolId', column: 'school_id', writable: false },
    { field: 'code', column: 'code' },
    { field: 'name', column: 'name' },
    { field: 'cityId', column: 'city_id', toParam: intToText, fromRow: toInt },
    { field: 'cityName', column: 'city_name' },
    { field: 'address', column: 'address' },
    { field: 'phone', column: 'phone' },
    { field: 'email', column: 'email' },
    { field: 'status', column: 'status' },
    ...AUDIT_FIELDS,
  ];

  async softDeleteCascade(id: number): Promise<boolean> {
    try {
      return await withTransaction(async (client) => {
        const found = await client.query(
          'SELECT 1 FROM academic.school WHERE school_id = $1 AND deleted_at IS NULL FOR UPDATE',
          [id],
        );
        if (found.rowCount === 0) return false;

        // Children first; each statement only touches rows that are still alive.
        const programs = 'SELECT program_id FROM academic.program WHERE school_id = $1';
        const cohorts = `SELECT cohort_id FROM academic.cohort WHERE program_id IN (${programs})`;
        const actors = 'SELECT academic_actor_id FROM academic.academic_actor WHERE school_id = $1';
        const cascade = [
          `UPDATE academic.enrollment SET deleted_at = NOW() WHERE deleted_at IS NULL
             AND (cohort_id IN (${cohorts}) OR academic_actor_id IN (${actors}))`,
          `UPDATE academic.cohort SET deleted_at = NOW() WHERE deleted_at IS NULL AND program_id IN (${programs})`,
          `UPDATE academic.course SET deleted_at = NOW() WHERE deleted_at IS NULL AND program_id IN (${programs})`,
          'UPDATE academic.program SET deleted_at = NOW() WHERE deleted_at IS NULL AND school_id = $1',
          'UPDATE academic.academic_period SET deleted_at = NOW() WHERE deleted_at IS NULL AND school_id = $1',
          'UPDATE academic.academic_actor SET deleted_at = NOW() WHERE deleted_at IS NULL AND school_id = $1',
          'UPDATE academic.school SET deleted_at = NOW() WHERE deleted_at IS NULL AND school_id = $1',
        ];
        for (const sql of cascade) await client.query(sql, [id]);
        return true;
      });
    } catch (err) {
      throw err instanceof RepositoryError ? err : translateDbError(err, this.qualifiedTable);
    }
  }
}
