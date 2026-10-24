import { toSnakeDeep } from '../backend';

describe('toSnakeDeep keys', () => {
  it('converts camelCase and acronym boundaries', () => {
    expect(toSnakeDeep({ academicActorId: 1, userID: 2, HTTPServer: 3, a1B: 4 })).toEqual({
      academic_actor_id: 1,
      user_id: 2,
      http_server: 3,
      a1_b: 4,
    });
  });

  it('stays linear on a long run of capitals', () => {
    const start = Date.now();
    const out = toSnakeDeep({ [`${'A'.repeat(60000)}`]: 1 });
    expect(Object.keys(out)).toHaveLength(1);
    expect(Date.now() - start).toBeLessThan(250);
  });
});
