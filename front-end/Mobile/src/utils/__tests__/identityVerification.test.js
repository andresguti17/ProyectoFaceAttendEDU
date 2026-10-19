import {normalizeBloodType, normalizeDate, verifyQuestionnaireAnswers} from '../identityVerification';

const person = {
    documentNumber: '1.020.304',
    bloodType: 'O_POSITIVE',
    birthDate: '2000-12-31',
    phone: '+57 300 123 4567',
};

const answers = {
    documentNumber: '1020304',
    rhType: 'O+',
    birthDate: '31/12/2000',
    phone: '3001234567',
};

describe('identityVerification', () => {
    it('normaliza RH y fechas', () => {
        expect(normalizeBloodType('ab negativo')).toBe('AB-');
        expect(normalizeDate('1/2/1999')).toBe('1999-02-01');
        expect(normalizeDate('1999-02-01T00:00:00')).toBe('1999-02-01');
    });

    it('acepta respuestas que coinciden con la persona', () => {
        expect(verifyQuestionnaireAnswers(person, answers)).toBe(true);
    });

    it('rechaza un documento distinto', () => {
        expect(verifyQuestionnaireAnswers(person, {...answers, documentNumber: '999'})).toBe(false);
    });

    it('rechaza un dato registrado que no coincide', () => {
        expect(verifyQuestionnaireAnswers(person, {...answers, birthDate: '01/01/2000'})).toBe(false);
    });

    it('ignora los datos que la persona no tiene registrados', () => {
        expect(verifyQuestionnaireAnswers({document_number: '1020304'}, {...answers, phone: ''})).toBe(true);
    });

    it('rechaza si no hay persona', () => {
        expect(verifyQuestionnaireAnswers(null, answers)).toBe(false);
    });
});
