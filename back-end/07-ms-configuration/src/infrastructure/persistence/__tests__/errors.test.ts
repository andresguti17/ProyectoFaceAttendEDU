import {
  ConflictError,
  DatabaseUnavailableError,
  InvalidReferenceError,
  InvalidValueError,
  NotFoundError,
  RepositoryError,
  RetryableError,
  translateDbError,
} from '../errors';

// A database failure must become a client-safe status, never a raw driver message.
describe('translateDbError', () => {
  it.each([
    ['23505', 409, ConflictError],
    ['23P01', 409, ConflictError],
    ['23503', 400, InvalidReferenceError],
    ['23502', 400, InvalidValueError],
    ['23514', 400, InvalidValueError],
    ['22001', 400, InvalidValueError],
    ['22003', 400, InvalidValueError],
    ['22007', 400, InvalidValueError],
    ['22008', 400, InvalidValueError],
    ['22P02', 400, InvalidValueError],
    ['22023', 400, InvalidValueError],
    ['22025', 400, InvalidValueError],
    ['40P01', 503, RetryableError],
    ['40001', 503, RetryableError],
    ['08003', 503, DatabaseUnavailableError],
    ['08006', 503, DatabaseUnavailableError],
    ['08001', 503, DatabaseUnavailableError],
  ])('SQLSTATE %s -> %i', (code, status, type) => {
    const err = translateDbError({ code, constraint: 'uq_school_code', column: 'code', detail: 'Key (code)=(S1) exists' }, 'configuration.academic_configuration');
    expect(err).toBeInstanceOf(type);
    expect(err.statusCode).toBe(status);
  });

  it('describes the constraint and keeps the detail for conflicts and bad references', () => {
    const conflict = translateDbError({ code: '23505', constraint: 'uq_school_code', detail: 'dup' }, 'configuration.academic_configuration');
    expect(conflict.message).toBe('configuration.academic_configuration already exists (uq_school_code)');
    expect(conflict.details).toEqual({ entity: 'configuration.academic_configuration', constraint: 'uq_school_code', detail: 'dup' });
    const reference = translateDbError({ code: '23503' }, 'configuration.biometric_update_case');
    expect(reference.details).toEqual({ entity: 'configuration.biometric_update_case', constraint: 'unknown constraint' });
  });

  it('names the column for missing or too long values', () => {
    expect(translateDbError({ code: '23502', column: 'name' }, 'configuration.security_configuration').message).toMatch(/'name' on configuration.security_configuration/);
    expect(translateDbError({ code: '22001' }, 'configuration.security_configuration').message).toMatch(/too long for column 'unknown constraint'/);
  });

  it('schema drift and unknown errors are 500 without the driver message', () => {
    const drift = translateDbError({ code: '42P01', message: 'relation "x" does not exist' }, 'configuration.academic_configuration');
    expect(drift.statusCode).toBe(500);
    expect(drift.message).toBe('Database schema mismatch for configuration.academic_configuration');
    const unknown = translateDbError(new Error('boom'));
    expect(unknown.statusCode).toBe(500);
    expect(unknown.message).toBe('Unexpected database error');
    expect(translateDbError(null).statusCode).toBe(500);
  });

  it('passes a RepositoryError through unchanged', () => {
    const original = new NotFoundError('configuration.academic_configuration', 7);
    expect(translateDbError(original)).toBe(original);
    expect(original.statusCode).toBe(404);
    expect(original.details).toEqual({ entity: 'configuration.academic_configuration', id: '7' });
    expect(original).toBeInstanceOf(RepositoryError);
    expect(new DatabaseUnavailableError().details).toBeUndefined();
  });
});
