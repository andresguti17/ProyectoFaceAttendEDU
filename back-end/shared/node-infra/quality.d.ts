// Structural Fastify shape: this package has no node_modules of its own.
export interface FastifyLike {
  addHook(...args: any[]): unknown;
  get(...args: any[]): unknown;
}

export interface QualityAudit {
  registerQualityMiddleware(app: FastifyLike): void;
  registerQualityHealthEndpoint(app: FastifyLike): void;
  buildQualityReport(): Record<string, unknown>;
}

export function createQualityAudit(serviceName: string): QualityAudit;
export function classifyOperation(method: string, url: string): string;
export function classifyISOClause(status: number): string;
