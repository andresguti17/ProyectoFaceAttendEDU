export class RepositoryError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details?: unknown;
  constructor(statusCode: number, errorCode: string, message: string, details?: unknown, cause?: unknown);
}
export class NotFoundError extends RepositoryError {
  constructor(entity: string, id: unknown);
}
export class ConflictError extends RepositoryError {
  constructor(entity: string, constraint: string, cause?: unknown);
}
export class InvalidReferenceError extends RepositoryError {
  constructor(entity: string, constraint: string, cause?: unknown);
}
export class InvalidValueError extends RepositoryError {
  constructor(message: string, details?: unknown, cause?: unknown);
}
export class DatabaseUnavailableError extends RepositoryError {
  constructor(cause?: unknown);
}
export class RetryableError extends RepositoryError {
  constructor(message: string);
}
export function translateDbError(err: unknown, entity?: string): RepositoryError;
