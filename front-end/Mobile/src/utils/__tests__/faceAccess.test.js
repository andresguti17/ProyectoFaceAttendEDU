import {faceAccessDenial} from '../faceAccess';

describe('faceAccessDenial', () => {
    it('blocks the face update until the questionnaire is verified', () => {
        expect(faceAccessDenial({isUpdate: true, unlocked: false})).toBe('updateLocked');
        expect(faceAccessDenial({isUpdate: true, unlocked: true})).toBeNull();
    });

    it('lets a non-admin register a face only once', () => {
        expect(faceAccessDenial({role: 'Aprendiz', hasFace: false})).toBeNull();
        expect(faceAccessDenial({role: 'Aprendiz', hasFace: true})).toBe('alreadyRegistered');
        expect(faceAccessDenial({role: 'Instructor', hasFace: true})).toBe('alreadyRegistered');
    });

    it('exempts administrators from the single registration', () => {
        expect(faceAccessDenial({role: 'Administrador', hasFace: true})).toBeNull();
        expect(faceAccessDenial({role: 'Super Administrador', hasFace: true})).toBeNull();
    });
});
