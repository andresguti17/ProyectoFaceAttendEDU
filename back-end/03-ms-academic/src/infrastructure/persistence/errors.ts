/**
 * Persistence error model — 03-ms-academic.
 *
 * Translates driver-level failures into `RepositoryError`s that carry an HTTP
 * status code. `main.ts`'s Fastify error handler turns them into the same JSON
 * envelope the HTTP layer already used for validation failures, so a database
 * problem never surfaces as an opaque 500 and never leaks a raw driver message.
 *
 * Referential-integrity violations are reported as **400**, not 500: a client
 * that points at a row which does not exist made a bad request.
 */

export class RepositoryError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
    // Restore the prototype chain: `extends Error` loses it when compiling to ES5-ish targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Requested row is absent (or soft-deleted). */
export class NotFoundError extends RepositoryError {
  constructor(entity: string, id: unknown) {
    super(404, 'NotFound', `${entity} '${String(id)}' was not found`, { entity, id: String(id) });
    this.name = 'NotFoundError';
  }
}

/** A UNIQUE constraint already holds the value the client sent. */
export class ConflictError extends RepositoryError {
  constructor(entity: string, constraint: string, detail?: string) {
    super(409, 'Conflict', `${entity} already exists (${constraint})`, {
      entity,
      constraint,
      ...(detail ? { detail } : {}),
    });
    this.name = 'ConflictError';
  }
}

/** A referenced parent row does not exist. 4xx by design — never a 500. */
export class InvalidReferenceError extends RepositoryError {
  constructor(entity: string, constraint: string, detail?: string) {
    super(400, 'BadRequest', `Referenced record for ${entity} does not exist (${constraint})`, {
      entity,
      constraint,
      ...(detail ? { detail } : {}),
    });
    this.name = 'InvalidReferenceError';
  }
}

/** Client value rejected by the database (NOT NULL, CHECK, type, length, enum). */
export class InvalidValueError extends RepositoryError {
  constructor(message: string, details?: unknown) {
    super(400, 'BadRequest', message, details);
    this.name = 'InvalidValueError';
  }
}

/** Pool is closed / database unreachable. */
export class DatabaseUnavailableError extends RepositoryError {
  constructor(detail?: string) {
    super(503, 'ServiceUnavailable', 'Database is unavailable', detail ? { detail } : undefined);
    this.name = 'DatabaseUnavailableError';
  }
}

/** Serialisation conflict — safe for the client to retry. */
export class RetryableError extends RepositoryError {
  constructor(message: string) {
    super(503, 'ServiceUnavailable', message);
    this.name = 'RetryableError';
  }
}

// PostgreSQL SQLSTATE codes — https://www.postgresql.org/docs/current/errcodes-appendix.html
const SQLSTATE = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
  STRING_DATA_RIGHT_TRUNCATION: '22001',
  NUMERIC_VALUE_OUT_OF_RANGE: '22003',
  INVALID_DATETIME_FORMAT: '22007',
  DATETIME_FIELD_OVERFLOW: '22008',
  INVALID_TEXT_REPRESENTATION: '22P02',
  INVALID_PARAMETER_VALUE: '22023',
  INVALID_REGULAR_EXPRESSION: '22025',
  DEADLOCK_DETECTED: '40P01',
  SERIALIZATION_FAILURE: '40001',
  CONNECTION_DOES_NOT_EXIST: '08003',
  CONNECTION_FAILURE: '08006',
  SQLCLIENT_UNABLE_TO_ESTABLISH: '08001',
  UNDEFINED_COLUMN: '42703',
  UNDEFINED_TABLE: '42P01',
} as const;

interface PgErrorLike {
  code?: string;
  message?: string;
  constraint?: string;
  table?: string;
  column?: string;
  detail?: string;
}

function asPgError(err: unknown): PgErrorLike {
  return (err ?? {}) as PgErrorLike;
}

/**
 * Maps a driver error onto a `RepositoryError` with the right HTTP status.
 * `entity` is the schema-qualified table the statement targeted; it is used only
 * to build a human-readable message, never interpolated into SQL.
 */
export function translateDbError(err: unknown, entity = 'record'): RepositoryError {
  if (err instanceof RepositoryError) return err;

  const pgErr = asPgError(err);
  const code = pgErr.code ?? '';
  const constraint = pgErr.constraint ?? 'unknown constraint';
  const rawMessage = pgErr.message ?? 'Unexpected database error';

  switch (code) {
    case SQLSTATE.UNIQUE_VIOLATION:
    case SQLSTATE.EXCLUSION_VIOLATION:
      return new ConflictError(entity, constraint, pgErr.detail);

    case SQLSTATE.FOREIGN_KEY_VIOLATION:
      return new InvalidReferenceError(entity, constraint, pgErr.detail);

    case SQLSTATE.NOT_NULL_VIOLATION:
      return new InvalidValueError(`Missing required value for '${pgErr.column ?? constraint}' on ${entity}`, {
        constraint,
        column: pgErr.column,
      });

    case SQLSTATE.CHECK_VIOLATION:
      return new InvalidValueError(`Value rejected by check constraint '${constraint}' on ${entity}`, {
        constraint,
      });

    case SQLSTATE.STRING_DATA_RIGHT_TRUNCATION:
      return new InvalidValueError(`Value too long for column '${pgErr.column ?? constraint}' on ${entity}`, {
        column: pgErr.column,
      });

    case SQLSTATE.NUMERIC_VALUE_OUT_OF_RANGE:
    case SQLSTATE.INVALID_DATETIME_FORMAT:
    case SQLSTATE.DATETIME_FIELD_OVERFLOW:
    case SQLSTATE.INVALID_TEXT_REPRESENTATION:
    case SQLSTATE.INVALID_PARAMETER_VALUE:
    case SQLSTATE.INVALID_REGULAR_EXPRESSION:
      return new InvalidValueError(`Invalid value supplied for ${entity}`, { code, detail: rawMessage });

    case SQLSTATE.DEADLOCK_DETECTED:
    case SQLSTATE.SERIALIZATION_FAILURE:
      return new RetryableError('Concurrent write conflict, please retry');

    case SQLSTATE.CONNECTION_DOES_NOT_EXIST:
    case SQLSTATE.CONNECTION_FAILURE:
    case SQLSTATE.SQLCLIENT_UNABLE_TO_ESTABLISH:
      return new DatabaseUnavailableError(rawMessage);

    case SQLSTATE.UNDEFINED_COLUMN:
    case SQLSTATE.UNDEFINED_TABLE:
      // Schema drift between the service and Liquibase — an operator problem.
      return new RepositoryError(500, 'InternalError', `Database schema mismatch for ${entity}`, { code });

    default:
      return new RepositoryError(500, 'InternalError', 'Unexpected database error', { code });
  }
}
