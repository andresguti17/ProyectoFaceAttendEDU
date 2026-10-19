import {
  ALL_OBJECTIVE_IDS,
  ISO29110_OBJECTIVE_COUNT,
  ISO29110_PROCESSES,
  deliveryReadiness,
  processOfObjective,
  rateProcess,
  scoreProcess,
} from '../domain/iso29110';

describe('ISO29110_OBJECTIVE_COUNT / ALL_OBJECTIVE_IDS', () => {
  it('matches the number of objectives actually listed across processes', () => {
    const total = ISO29110_PROCESSES.reduce((acc, p) => acc + p.objectives.length, 0);
    expect(ISO29110_OBJECTIVE_COUNT).toBe(total);
    expect(ALL_OBJECTIVE_IDS).toHaveLength(total);
  });
});

describe('processOfObjective', () => {
  it('resolves an objective id to its owning process', () => {
    expect(processOfObjective('PM.O1')).toBe('PM');
    expect(processOfObjective('SI.O12')).toBe('SI');
  });

  it('returns null for an objective id whose prefix does not match a known process', () => {
    expect(processOfObjective('QA.O1')).toBeNull();
  });
});

describe('scoreProcess', () => {
  const pm = ISO29110_PROCESSES.find((p) => p.id === 'PM')!;

  it('returns 0 for an unknown processId instead of throwing', () => {
    expect(scoreProcess({}, 'UNKNOWN')).toBe(0);
  });

  it('does not divide by zero when ratings is empty: missing ratings count as N (0)', () => {
    const score = scoreProcess({}, 'PM');
    expect(score).toBe(0);
  });

  it('scores 100 when every objective of the process is rated F', () => {
    const ratings = Object.fromEntries(pm.objectives.map((o) => [o.id, 'F' as const]));
    expect(scoreProcess(ratings, 'PM')).toBe(100);
  });

  it('scores 0 when every objective is rated N', () => {
    const ratings = Object.fromEntries(pm.objectives.map((o) => [o.id, 'N' as const]));
    expect(scoreProcess(ratings, 'PM')).toBe(0);
  });

  it('computes the documented percentage for a realistic mixed-rating case', () => {
    // PM has 8 objectives; max points = 8 * 3 = 24.
    const ratings: Record<string, 'N' | 'P' | 'L' | 'F'> = {};
    pm.objectives.forEach((o, i) => {
      ratings[o.id] = (['N', 'P', 'L', 'F'] as const)[i % 4];
    });
    const totalPoints = pm.objectives.reduce((acc, o, i) => acc + { N: 0, P: 1, L: 2, F: 3 }[ratings[o.id]], 0);
    const expected = Math.round((totalPoints / (pm.objectives.length * 3)) * 1000) / 10;
    expect(scoreProcess(ratings, 'PM')).toBe(expected);
  });

  it('ignores an objective id from a different process (unknown rating -> treated as N/0)', () => {
    // Rating an SI objective inside a PM lookup should not count towards PM's score.
    const score = scoreProcess({ 'SI.O1': 'F' }, 'PM');
    expect(score).toBe(0);
  });
});

describe('rateProcess (boundaries read from the source, not guessed)', () => {
  it('is N for 0 and exactly 15 (inclusive upper bound)', () => {
    expect(rateProcess(0)).toBe('N');
    expect(rateProcess(15)).toBe('N');
  });

  it('flips to P just above 15, and stays P up to and including 50', () => {
    expect(rateProcess(15.1)).toBe('P');
    expect(rateProcess(50)).toBe('P');
  });

  it('flips to L just above 50, and stays L up to and including 85', () => {
    expect(rateProcess(50.1)).toBe('L');
    expect(rateProcess(85)).toBe('L');
  });

  it('flips to F just above 85, up to 100', () => {
    expect(rateProcess(85.1)).toBe('F');
    expect(rateProcess(100)).toBe('F');
  });
});

describe('deliveryReadiness', () => {
  it('is not ready when there are no processes scored yet (empty input)', () => {
    const result = deliveryReadiness({});
    expect(result.ready).toBe(false);
    expect(result.label).toBe('No listo para entrega');
  });

  it('is not ready when a process is exactly at 50 (rule requires STRICTLY greater than 50)', () => {
    const result = deliveryReadiness({ PM: 50, SI: 60 });
    expect(result.ready).toBe(false);
  });

  it('is ready only when every process exceeds 50', () => {
    const result = deliveryReadiness({ PM: 50.1, SI: 100 });
    expect(result.ready).toBe(true);
    expect(result.label).toBe('Listo para entrega');
  });

  it('is not ready if any single process is at or below 50, even if others are high', () => {
    const result = deliveryReadiness({ PM: 100, SI: 40 });
    expect(result.ready).toBe(false);
  });
});
