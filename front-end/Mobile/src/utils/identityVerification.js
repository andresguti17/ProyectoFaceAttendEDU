// Verifica las respuestas del cuestionario de FacialFail contra la persona
// registrada (GET /api/v1/persons/{id}) antes de permitir actualizar el rostro.
// Solo se comparan los datos que el backend guarda (documento, RH, fecha de
// nacimiento y teléfono); el documento es obligatorio y el resto se exige
// cuando la persona lo tiene registrado.

const digits = (value) => String(value ?? '').replace(/\D/g, '');

const pick = (person, ...keys) => {
    for (const key of keys) {
        if (person?.[key] !== undefined && person?.[key] !== null && person?.[key] !== '') return person[key];
    }
    return null;
};

/** "O_POSITIVE", "o+", "O Positivo" -> "O+" */
export function normalizeBloodType(value) {
    return String(value ?? '')
        .toUpperCase()
        .replace(/POSITIV[OE]/g, '+')
        .replace(/NEGATIV[OE]/g, '-')
        .replace(/[^ABO+-]/g, '');
}

/** "31/12/2000" (DatePickerInput) -> "2000-12-31"; ISO se deja en AAAA-MM-DD. */
export function normalizeDate(value) {
    const text = String(value ?? '').trim();
    const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return text.slice(0, 10);
}

// Se comparan los últimos 10 dígitos para tolerar el indicativo de país.
const samePhone = (a, b) => digits(a).slice(-10) === digits(b).slice(-10);

export function verifyQuestionnaireAnswers(person, answers) {
    if (!person || !answers) return false;

    const document = pick(person, 'documentNumber', 'document_number');
    if (!document || digits(document) !== digits(answers.documentNumber)) return false;

    const checks = [
        [pick(person, 'bloodType', 'blood_type'),
            (v) => normalizeBloodType(v) === normalizeBloodType(answers.rhType)],
        [pick(person, 'birthDate', 'birth_date'),
            (v) => normalizeDate(v) === normalizeDate(answers.birthDate)],
        [pick(person, 'phone'),
            (v) => samePhone(v, answers.phone)],
    ];
    return checks.every(([stored, matches]) => stored === null || matches(stored));
}
