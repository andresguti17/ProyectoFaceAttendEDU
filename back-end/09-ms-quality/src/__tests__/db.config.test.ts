import { resolveDatabaseConfig } from '../infrastructure/db/database';

describe('database configuration', () => {
  it('uses the environment and keeps safe defaults', () => {
    const cfg = resolveDatabaseConfig({ DATABASE_URL: 'postgres://u@h/db', POSTGRES_POOL_MAX: '5', POSTGRES_PORT: 'abc' });
    expect(cfg).toMatchObject({ connectionString: 'postgres://u@h/db', max: 5, port: 5432, schema: 'quality' });
    expect(resolveDatabaseConfig({ PG_SCHEMA: 'quality_test' }).schema).toBe('quality_test');
  });

  it('never takes a schema name that could inject SQL into search_path', () => {
    expect(resolveDatabaseConfig({ DB_SCHEMA: 'quality; DROP TABLE x' }).schema).toBe('quality');
    expect(resolveDatabaseConfig({ DB_SCHEMA: '1quality' }).schema).toBe('quality');
  });
});
