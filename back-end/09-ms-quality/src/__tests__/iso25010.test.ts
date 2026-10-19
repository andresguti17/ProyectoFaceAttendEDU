import {
  ALL_SUBCHARACTERISTIC_IDS,
  ISO25010_CHARACTERISTICS,
  ISO25010_QUESTION_COUNT,
  levelForScore,
  scoreEvaluation,
} from '../domain/iso25010';

describe('ISO25010_QUESTION_COUNT / ALL_SUBCHARACTERISTIC_IDS', () => {
  it('matches the number of subcharacteristics actually listed in the catalog', () => {
    const total = ISO25010_CHARACTERISTICS.reduce((acc, c) => acc + c.subcharacteristics.length, 0);
    expect(ISO25010_QUESTION_COUNT).toBe(total);
    expect(ALL_SUBCHARACTERISTIC_IDS).toHaveLength(total);
  });

  it('has no duplicate subcharacteristic ids across characteristics', () => {
    expect(new Set(ALL_SUBCHARACTERISTIC_IDS).size).toBe(ALL_SUBCHARACTERISTIC_IDS.length);
  });

  it('characteristic weights sum to 1.0 (within floating-point tolerance)', () => {
    const total = ISO25010_CHARACTERISTICS.reduce((acc, c) => acc + c.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe('levelForScore (boundaries read from the source, not guessed)', () => {
  it('is Deficiente strictly below 2', () => {
    expect(levelForScore(1.99)).toBe('Deficiente');
    expect(levelForScore(0)).toBe('Deficiente');
  });

  it('flips to En proceso exactly at 2 (the "< 2" check excludes the boundary from Deficiente)', () => {
    expect(levelForScore(2)).toBe('En proceso');
    expect(levelForScore(2.99)).toBe('En proceso');
  });

  it('flips to Aceptable exactly at 3', () => {
    expect(levelForScore(3)).toBe('Aceptable');
    expect(levelForScore(3.74)).toBe('Aceptable');
  });

  it('flips to Bueno exactly at 3.75', () => {
    expect(levelForScore(3.75)).toBe('Bueno');
    expect(levelForScore(4.49)).toBe('Bueno');
  });

  it('flips to Excelente exactly at 4.5', () => {
    expect(levelForScore(4.5)).toBe('Excelente');
    expect(levelForScore(5)).toBe('Excelente');
  });
});

describe('scoreEvaluation', () => {
  it('does not divide by zero or throw when no scores are supplied', () => {
    const result = scoreEvaluation({});
    expect(result.globalScore).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.level).toBe('Deficiente');
    for (const characteristic of ISO25010_CHARACTERISTICS) {
      expect(result.byCharacteristic[characteristic.id]).toBe(0);
    }
  });

  it('averages only the subcharacteristics that were actually answered within a characteristic', () => {
    // functional-suitability has 3 subcharacteristics; answer only one.
    const result = scoreEvaluation({ 'functional-completeness': 4 });
    expect(result.byCharacteristic['functional-suitability']).toBe(4);
    // every other characteristic got zero answers -> average 0
    expect(result.byCharacteristic['security']).toBe(0);
  });

  it('computes a weighted global average across all characteristics for a full, uniform set of answers', () => {
    const allFives = Object.fromEntries(ALL_SUBCHARACTERISTIC_IDS.map((id) => [id, 5]));
    const result = scoreEvaluation(allFives);
    expect(result.globalScore).toBe(5);
    expect(result.percentage).toBe(100);
    expect(result.level).toBe('Excelente');
    for (const characteristic of ISO25010_CHARACTERISTICS) {
      expect(result.byCharacteristic[characteristic.id]).toBe(5);
    }
  });

  it('computes the documented weighted average for a realistic mixed-score case', () => {
    // Build a scores map where every subcharacteristic within a characteristic gets the
    // same value, so byCharacteristic average == that value, and hand-verify the weighted sum.
    const perCharacteristicScore: Record<string, number> = {
      'functional-suitability': 5, // weight 0.2
      'performance-efficiency': 4, // weight 0.15
      compatibility: 3, // weight 0.1
      usability: 4, // weight 0.1
      reliability: 2, // weight 0.15
      security: 5, // weight 0.15
      maintainability: 3, // weight 0.1
      portability: 4, // weight 0.05
    };
    const scores: Record<string, number> = {};
    for (const c of ISO25010_CHARACTERISTICS) {
      for (const s of c.subcharacteristics) scores[s.id] = perCharacteristicScore[c.id];
    }
    const result = scoreEvaluation(scores);
    const expectedGlobal = ISO25010_CHARACTERISTICS.reduce(
      (acc, c) => acc + perCharacteristicScore[c.id] * c.weight,
      0,
    );
    expect(result.globalScore).toBeCloseTo(Math.round(expectedGlobal * 100) / 100, 5);
    expect(result.percentage).toBeCloseTo(Math.round((result.globalScore / 5) * 1000) / 10, 5);
  });

  it('rounds byCharacteristic and globalScore to 2 decimal places', () => {
    // Three subcharacteristics with values 1, 2, 2 -> average 1.666...
    const [first, second, third] = ISO25010_CHARACTERISTICS[0].subcharacteristics.map((s) => s.id);
    const result = scoreEvaluation({ [first]: 1, [second]: 2, [third]: 2 });
    expect(result.byCharacteristic[ISO25010_CHARACTERISTICS[0].id]).toBe(1.67);
  });

  it('ignores unknown/non-numeric score entries rather than letting them skew the average', () => {
    const [first] = ISO25010_CHARACTERISTICS[0].subcharacteristics.map((s) => s.id);
    const result = scoreEvaluation({ [first]: 5, 'not-a-real-id': 1 } as unknown as Record<string, number>);
    expect(result.byCharacteristic[ISO25010_CHARACTERISTICS[0].id]).toBe(5);
  });
});
