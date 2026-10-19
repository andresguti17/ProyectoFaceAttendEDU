import {
  ALL_ISTQB_ITEM_IDS,
  ISTQB_CATEGORIES,
  ISTQB_QUESTION_COUNT,
  istqbLevelForScore,
  scoreIstqbEvaluation,
} from '../domain/istqb';

describe('ISTQB_QUESTION_COUNT / ALL_ISTQB_ITEM_IDS', () => {
  it('matches the number of items actually listed in the catalog', () => {
    const total = ISTQB_CATEGORIES.reduce((acc, c) => acc + c.items.length, 0);
    expect(ISTQB_QUESTION_COUNT).toBe(total);
    expect(ALL_ISTQB_ITEM_IDS).toHaveLength(total);
  });

  it('has no duplicate item ids across categories', () => {
    expect(new Set(ALL_ISTQB_ITEM_IDS).size).toBe(ALL_ISTQB_ITEM_IDS.length);
  });

  it('category weights sum to 1.0 (within floating-point tolerance)', () => {
    const total = ISTQB_CATEGORIES.reduce((acc, c) => acc + c.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe('istqbLevelForScore (boundaries read from the source, not guessed)', () => {
  it('is Deficiente strictly below 2', () => {
    expect(istqbLevelForScore(1.99)).toBe('Deficiente');
  });

  it('flips to En proceso exactly at 2', () => {
    expect(istqbLevelForScore(2)).toBe('En proceso');
  });

  it('flips to Aceptable exactly at 3', () => {
    expect(istqbLevelForScore(3)).toBe('Aceptable');
  });

  it('flips to Bueno exactly at 3.75', () => {
    expect(istqbLevelForScore(3.75)).toBe('Bueno');
  });

  it('flips to Excelente exactly at 4.5', () => {
    expect(istqbLevelForScore(4.5)).toBe('Excelente');
  });
});

describe('scoreIstqbEvaluation', () => {
  it('does not divide by zero or throw when no scores are supplied', () => {
    const result = scoreIstqbEvaluation({});
    expect(result.globalScore).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.level).toBe('Deficiente');
    for (const category of ISTQB_CATEGORIES) {
      expect(result.byCategory[category.id]).toBe(0);
    }
  });

  it('computes a weighted global average across all categories for a full, uniform set of answers', () => {
    const allFives = Object.fromEntries(ALL_ISTQB_ITEM_IDS.map((id) => [id, 5]));
    const result = scoreIstqbEvaluation(allFives);
    expect(result.globalScore).toBe(5);
    expect(result.percentage).toBe(100);
    expect(result.level).toBe('Excelente');
  });

  it('computes the documented weighted average for a realistic mixed-score case', () => {
    const perCategoryScore: Record<string, number> = {
      fundamentals: 4,
      lifecycle: 3,
      'static-testing': 5,
      techniques: 2,
      management: 4,
      tools: 3,
    };
    const scores: Record<string, number> = {};
    for (const c of ISTQB_CATEGORIES) {
      for (const item of c.items) scores[item.id] = perCategoryScore[c.id];
    }
    const result = scoreIstqbEvaluation(scores);
    const expectedGlobal = ISTQB_CATEGORIES.reduce((acc, c) => acc + perCategoryScore[c.id] * c.weight, 0);
    expect(result.globalScore).toBeCloseTo(Math.round(expectedGlobal * 100) / 100, 5);
  });

  it('averages only the items actually answered within a category', () => {
    const [firstItem] = ISTQB_CATEGORIES[0].items.map((i) => i.id);
    const result = scoreIstqbEvaluation({ [firstItem]: 3 });
    expect(result.byCategory[ISTQB_CATEGORIES[0].id]).toBe(3);
    expect(result.byCategory[ISTQB_CATEGORIES[1].id]).toBe(0);
  });
});
