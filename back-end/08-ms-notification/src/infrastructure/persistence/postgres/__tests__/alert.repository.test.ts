import { PostgresAlertRepository } from '../alert.repository';
jest.mock('../../../db/database', () => ({ runQuery: jest.fn(), runCommand: jest.fn() }));
const database = require('../../../db/database');

describe('PostgresAlertRepository.findByActorAndType', () => {
  it('filters by academic_actor_id and alert_type_id', async () => {
    database.runQuery.mockResolvedValueOnce([]);
    const repo = new PostgresAlertRepository();
    await repo.findByActorAndType(42, 3);
    const [sql, params] = database.runQuery.mock.calls[0];
    expect(sql).toContain('WHERE academic_actor_id = $1 AND alert_type_id = $2 AND deleted_at IS NULL');
    expect(params).toEqual([42, 3]);
  });
});

describe('PostgresAlertRepository.findFiltered', () => {
  it('pushes the actor scope into the WHERE clause before LIMIT/OFFSET', async () => {
    database.runQuery.mockResolvedValueOnce([]);
    const repo = new PostgresAlertRepository();
    await repo.findFiltered({ actorIds: [4, 9], typeId: 2, limit: 10, offset: 20 });
    const [sql, params] = database.runQuery.mock.calls.at(-1);
    expect(sql).toContain('academic_actor_id = ANY($1::bigint[])');
    expect(sql).toContain('alert_type_id = $2');
    expect(sql).toContain('ORDER BY raised_at DESC LIMIT $3 OFFSET $4');
    expect(params).toEqual([[4, 9], 2, 10, 20]);
  });

  it('matches no rows for an empty scope without sending an empty array', async () => {
    database.runQuery.mockResolvedValueOnce([]);
    const repo = new PostgresAlertRepository();
    await repo.findFiltered({ actorIds: [] });
    const [sql, params] = database.runQuery.mock.calls.at(-1);
    expect(sql).toContain('FALSE');
    expect(params).toEqual([]);
  });

  it('does not restrict by actor when no scope is given (Super Administrador)', async () => {
    database.runQuery.mockResolvedValueOnce([]);
    const repo = new PostgresAlertRepository();
    await repo.findFiltered({});
    const [sql] = database.runQuery.mock.calls.at(-1);
    expect(sql).not.toContain('ANY(');
  });
});
