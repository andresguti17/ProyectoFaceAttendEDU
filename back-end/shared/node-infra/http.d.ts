import type { FastifyLike } from './quality';

export interface ServiceBasicsOptions {
  /** Name shown by /health, /api/v1/health and /health/ready. */
  service: string;
  /** Database probe behind /health/ready. */
  healthCheck(): Promise<{ ok: boolean; latencyMs: number }>;
}

export function registerServiceBasics(
  app: FastifyLike & { setErrorHandler(...args: any[]): unknown; setNotFoundHandler(...args: any[]): unknown },
  options: ServiceBasicsOptions,
): void;
export function errorNameFor(status: number): string;
