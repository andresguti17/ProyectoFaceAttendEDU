import { toCamelBody, toSnakeDeep } from '../backend';

jest.mock('../apiClient', () => ({ request: jest.fn(), GET: 'GET' }));

describe('toCamelBody', () => {
  it('converts snake keys and drops audit fields and empty values', () => {
    expect(
      toCamelBody({ school_id: 3, code: 'A-1', capacity: 0, status: false, environment_id: null, row_version: 1, created_at: 'x' }),
    ).toEqual({ schoolId: 3, code: 'A-1', capacity: 0, status: false });
  });

  it('round-trips with toSnakeDeep', () => {
    expect(toSnakeDeep(toCamelBody({ academic_actor_id: 9 }))).toEqual({ academic_actor_id: 9 });
  });
});
