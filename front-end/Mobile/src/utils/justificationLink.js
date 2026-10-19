// La alerta del resultado (ERF 6.3) no guarda la justificación: se enlaza por la
// fecha de revisión, que attendance publica y notification guarda como raised_at.
const RESULT_CODES = ['JUSTIFICATION_APPROVED', 'JUSTIFICATION_REJECTED'];

export const isJustificationResultAlert = (alert) => RESULT_CODES.includes(alert?.code);

/** Justificación revisada en el mismo instante que la alerta (precisión de milisegundos). */
export function findByReviewedAt(items = [], reviewedAt) {
    const target = Date.parse(reviewedAt);
    if (Number.isNaN(target)) return null;
    return items.find((item) => item.reviewedAt && Date.parse(item.reviewedAt) === target) ?? null;
}
