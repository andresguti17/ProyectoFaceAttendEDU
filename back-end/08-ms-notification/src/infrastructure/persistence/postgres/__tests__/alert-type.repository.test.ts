import { PostgresAlertTypeRepository } from '../alert-type.repository';
jest.mock('../../../db/database', () => ({ runQuery: jest.fn(), runCommand: jest.fn() }));
const database = require('../../../db/database');

describe('PostgresAlertTypeRepository.findByCode', () => {
  it('queries by code filtering soft-deleted rows', async () => {
    database.runQuery.mockResolvedValueOnce([{ alert_type_id: 1, code: 'ABSENCE_THRESHOLD', name: 'x', severity: 'WARNING', channel: 'IN_APP', created_at: 't', updated_at: 't', deleted_at: null }]);
    const repo = new PostgresAlertTypeRepository();
    const found = await repo.findByCode('ABSENCE_THRESHOLD');
    expect(found?.code).toBe('ABSENCE_THRESHOLD');
    const [sql, params] = database.runQuery.mock.calls[0];
    expect(sql).toContain('WHERE code = $1 AND deleted_at IS NULL');
    expect(params).toEqual(['ABSENCE_THRESHOLD']);
  });
  it('returns null when nothing matches', async () => {
    database.runQuery.mockResolvedValueOnce([]);
    const repo = new PostgresAlertTypeRepository();
    expect(await repo.findByCode('MISSING')).toBeNull();
  });
});
