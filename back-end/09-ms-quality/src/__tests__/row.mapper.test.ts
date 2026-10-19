import {
  mapIstqbAssessmentRow,
  mapProcessAssessmentRow,
  mapQualityEvaluationRow,
  mapQualityProjectRow,
  omitNullish,
  toDateOnly,
  toIsoTimestamp,
  type IstqbAssessmentRow,
  type ProcessAssessmentRow,
  type QualityEvaluationRow,
  type QualityProjectRow,
} from '../infrastructure/persistence/pg/row.mapper';

describe('toIsoTimestamp', () => {
  it('returns null for null/undefined input', () => {
    expect(toIsoTimestamp(null)).toBeNull();
    expect(toIsoTimestamp(undefined as unknown as null)).toBeNull();
  });

  it('returns null for an empty/blank string', () => {
    expect(toIsoTimestamp('')).toBeNull();
    expect(toIsoTimestamp('   ')).toBeNull();
  });

  it('passes a Date instance through toISOString()', () => {
    const d = new Date('2026-09-23T14:03:22.123Z');
    expect(toIsoTimestamp(d)).toBe(d.toISOString());
  });

  it('treats a raw "YYYY-MM-DD HH:mm:ss" string from PostgreSQL as UTC', () => {
    expect(toIsoTimestamp('2026-09-23 14:03:22.123456')).toBe('2026-09-23T14:03:22.123Z');
  });

  it('accepts a string that already has a T separator', () => {
    expect(toIsoTimestamp('2026-09-23T14:03:22.000Z')).toBe('2026-09-23T14:03:22.000Z');
  });

  it('returns null for an unparsable string instead of throwing', () => {
    expect(toIsoTimestamp('not-a-date')).toBeNull();
  });
});

describe('toDateOnly', () => {
  it('returns null for null/undefined input', () => {
    expect(toDateOnly(null)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(toDateOnly('')).toBeNull();
  });

  it('slices a date-time string down to its first 10 characters', () => {
    expect(toDateOnly('2026-01-05T00:00:00.000Z')).toBe('2026-01-05');
  });

  it('passes a plain YYYY-MM-DD string through unchanged', () => {
    expect(toDateOnly('2026-01-05')).toBe('2026-01-05');
  });

  it('formats a Date using LOCAL getters, not UTC, to avoid shifting the day', () => {
    // pg returns DATE columns as a Date at local midnight; using toISOString() here
    // would shift the day backwards for any timezone east of UTC-0.
    const localMidnight = new Date(2026, 0, 5); // 5 Jan 2026, local midnight
    expect(toDateOnly(localMidnight)).toBe('2026-01-05');
  });

  it('zero-pads single-digit month and day', () => {
    const localMidnight = new Date(2026, 8, 3); // 3 Sep 2026
    expect(toDateOnly(localMidnight)).toBe('2026-09-03');
  });
});

describe('omitNullish', () => {
  it('drops null and undefined keys while keeping everything else', () => {
    const result = omitNullish({ a: 1, b: null, c: undefined, d: 0, e: '', f: false });
    expect(result).toEqual({ a: 1, d: 0, e: '', f: false });
  });

  it('preserves insertion order of the kept keys', () => {
    const result = omitNullish({ z: 1, a: null, m: 2 });
    expect(Object.keys(result)).toEqual(['z', 'm']);
  });

  it('returns an empty object when everything is nullish', () => {
    expect(omitNullish({ a: null, b: undefined })).toEqual({});
  });
});

describe('mapQualityProjectRow', () => {
  const baseRow: QualityProjectRow = {
    project_id: 1,
    project_name: 'FaceAttend Edu',
    description: null,
    customer: null,
    planned_start_on: null,
    planned_end_on: null,
    project_status: 'Planned',
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    deleted_at: null,
  };

  it('omits optional columns that came back NULL', () => {
    const mapped = mapQualityProjectRow(baseRow);
    expect(mapped).not.toHaveProperty('description');
    expect(mapped).not.toHaveProperty('customer');
    expect(mapped).not.toHaveProperty('plannedStart');
    expect(mapped).not.toHaveProperty('plannedEnd');
    expect(mapped.deletedAt).toBeNull();
  });

  it('maps populated optional columns and converts dates/timestamps', () => {
    const mapped = mapQualityProjectRow({
      ...baseRow,
      description: 'desc',
      customer: 'ACME',
      planned_start_on: '2026-02-01',
      planned_end_on: '2026-06-01',
    });
    expect(mapped.description).toBe('desc');
    expect(mapped.customer).toBe('ACME');
    expect(mapped.plannedStart).toBe('2026-02-01');
    expect(mapped.plannedEnd).toBe('2026-06-01');
    expect(mapped.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('mapQualityEvaluationRow', () => {
  const baseRow: QualityEvaluationRow = {
    evaluation_id: 10,
    service_name: '09-ms-quality',
    evaluator_name: 'QA',
    evaluation_scope: 'CRUD evaluations',
    project_id: null,
    evaluation_status: 'Draft',
    comments: null,
    global_score: null,
    percentage: null,
    quality_level: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    deleted_at: null,
  };

  it('always includes byCharacteristic, even an empty object, because it is never null/undefined', () => {
    const mapped = mapQualityEvaluationRow(baseRow, {}, {});
    expect(mapped.byCharacteristic).toEqual({});
  });

  it('omits globalScore/percentage/level/projectId when the persisted columns are NULL', () => {
    const mapped = mapQualityEvaluationRow(baseRow, {}, {});
    expect(mapped).not.toHaveProperty('globalScore');
    expect(mapped).not.toHaveProperty('percentage');
    expect(mapped).not.toHaveProperty('level');
    expect(mapped).not.toHaveProperty('projectId');
  });

  it('includes derived columns and scores when populated', () => {
    const mapped = mapQualityEvaluationRow(
      { ...baseRow, project_id: 3, global_score: 4.2, percentage: 84, quality_level: 'Bueno' },
      { 'functional-completeness': 5 },
      { 'functional-suitability': 4.5 },
    );
    expect(mapped.projectId).toBe(3);
    expect(mapped.globalScore).toBe(4.2);
    expect(mapped.percentage).toBe(84);
    expect(mapped.level).toBe('Bueno');
    expect(mapped.scores).toEqual({ 'functional-completeness': 5 });
    expect(mapped.byCharacteristic).toEqual({ 'functional-suitability': 4.5 });
  });
});

describe('mapProcessAssessmentRow', () => {
  const baseRow: ProcessAssessmentRow = {
    assessment_id: 1,
    project_id: 5,
    process_code: 'PM',
    assessor_name: 'Lead',
    assessment_status: 'Draft',
    comments: null,
    process_score: null,
    process_rating: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    deleted_at: null,
  };

  it('omits score/rating when NULL and keeps ratings as given', () => {
    const mapped = mapProcessAssessmentRow(baseRow, { 'PM.O1': 'F' });
    expect(mapped).not.toHaveProperty('score');
    expect(mapped).not.toHaveProperty('rating');
    expect(mapped.ratings).toEqual({ 'PM.O1': 'F' });
  });

  it('includes score/rating when populated', () => {
    const mapped = mapProcessAssessmentRow({ ...baseRow, process_score: 62.5, process_rating: 'L' }, {});
    expect(mapped.score).toBe(62.5);
    expect(mapped.rating).toBe('L');
  });
});

describe('mapIstqbAssessmentRow', () => {
  const baseRow: IstqbAssessmentRow = {
    istqb_assessment_id: 1,
    service_name: '09-ms-quality',
    evaluator_name: 'QA',
    assessment_scope: 'CRUD evaluations',
    project_id: null,
    assessment_status: 'Draft',
    comments: null,
    global_score: null,
    percentage: null,
    quality_level: null,
    created_at: '2026-01-01 00:00:00',
    updated_at: '2026-01-01 00:00:00',
    deleted_at: null,
  };

  it('always includes byCategory, even empty, and omits derived columns when NULL', () => {
    const mapped = mapIstqbAssessmentRow(baseRow, {}, {});
    expect(mapped.byCategory).toEqual({});
    expect(mapped).not.toHaveProperty('globalScore');
    expect(mapped).not.toHaveProperty('level');
  });

  it('includes derived columns when populated', () => {
    const mapped = mapIstqbAssessmentRow(
      { ...baseRow, global_score: 3.9, percentage: 78, quality_level: 'Aceptable' },
      { 'tech-bva': 4 },
      { techniques: 4 },
    );
    expect(mapped.globalScore).toBe(3.9);
    expect(mapped.level).toBe('Aceptable');
    expect(mapped.byCategory).toEqual({ techniques: 4 });
  });
});
