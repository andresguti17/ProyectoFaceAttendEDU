// HU-JUS-001 AC1/AC5: solo inasistencias y retardos sin justificación previa.
import { byRecordDateDesc, eligibleRecords, recordDate } from '../justificationEligibility';

const record = (id, status, capturedAt, sessionDate) => ({
  attendance_record_id: id, attendance_status: status, captured_at: capturedAt, session_date: sessionDate,
});

describe('eligibleRecords', () => {
  test('deja solo Absent y Late sin justificación', () => {
    const records = [
      record(1, 'Absent', null),
      record(2, 'Present', '2026-10-02T08:00:00'),
      record(3, 'Late', '2026-10-03T08:10:00'),
      record(4, 'Justified', '2026-10-04T08:00:00'),
      record(5, 'Absent', null),
    ];
    const justifications = [{ attendanceRecordId: 5 }];

    expect(eligibleRecords(records, justifications).map((r) => r.attendance_record_id)).toEqual([1, 3]);
  });

  test('compara ids aunque lleguen como texto', () => {
    expect(eligibleRecords([record(7, 'Late', null)], [{ attendanceRecordId: '7' }])).toEqual([]);
  });

  test('sin datos devuelve lista vacía', () => {
    expect(eligibleRecords()).toEqual([]);
  });
});

describe('recordDate', () => {
  test('una inasistencia sin captured_at toma la fecha de la sesión', () => {
    expect(recordDate(record(1, 'Absent', null, '2026-09-08'))).toBe('2026-09-08');
  });

  test('ordena del más reciente al más antiguo mezclando sesión y captura', () => {
    const list = [
      record(1, 'Absent', null, '2026-09-08'),
      record(2, 'Late', '2026-10-03T08:10:00', '2026-10-03'),
      record(3, 'Absent', null, '2026-09-21'),
      record(4, 'Late', '2026-09-30T08:10:00'),
    ];
    expect(list.sort(byRecordDateDesc).map((r) => r.attendance_record_id)).toEqual([2, 4, 3, 1]);
  });
});
