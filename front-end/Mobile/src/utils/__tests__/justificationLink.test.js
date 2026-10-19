// ERF 6.3: la alerta del resultado abre la justificación revisada en ese mismo instante.
import { findByReviewedAt, isJustificationResultAlert } from '../justificationLink';
import Justification from '../../models/attendance/Justification';

const items = [
  { id: 7, reviewedAt: '2026-10-17T16:07:31.701233Z' },
  { id: 8, reviewedAt: '2026-10-17T16:07:31.789000Z' },
  { id: 9, reviewedAt: null },
];

describe('findByReviewedAt', () => {
  test('casa el raised_at de notification (Go) con el reviewed_at de attendance (Java)', () => {
    expect(findByReviewedAt(items, '2026-10-17T16:07:31.701233Z')?.id).toBe(7);
    // Go recorta los ceros finales de la fracción: sigue siendo el mismo instante.
    expect(findByReviewedAt(items, '2026-10-17T16:07:31.789Z')?.id).toBe(8);
  });

  test('sin coincidencia o fecha inválida no abre nada', () => {
    expect(findByReviewedAt(items, '2026-10-17T16:07:32Z')).toBeNull();
    expect(findByReviewedAt(items, 'no-es-fecha')).toBeNull();
    expect(findByReviewedAt(undefined, '2026-10-17T16:07:31.701233Z')).toBeNull();
  });
});

test('solo las alertas de aprobación o rechazo enlazan a una justificación', () => {
  expect(isJustificationResultAlert({ code: 'JUSTIFICATION_REJECTED' })).toBe(true);
  expect(isJustificationResultAlert({ code: 'JUSTIFICATION_APPROVED' })).toBe(true);
  expect(isJustificationResultAlert({ code: 'JUSTIFICATION_PENDING' })).toBe(false);
  expect(isJustificationResultAlert(null)).toBe(false);
});

test('el modelo conserva el comentario del revisor', () => {
  expect(Justification.fromApi({ justification_id: 7, review_status: 'Rejected', resolution_notes: 'Soporte ilegible' }).resolutionNotes)
    .toBe('Soporte ilegible');
});
