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
