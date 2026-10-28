// Términos y condiciones en la app: el adulto los firma en su primer ingreso (una sola vez por
// versión); el menor no puede completarlos desde la app y queda bloqueado con el paso pendiente.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useLoginViewModel} from '../useLoginViewModel';
import {AuthService} from '../../services/AuthService';
import {ConsentService} from '../../services/consentService';
import {TermsService} from '../../services/termsService';
import {removeToken} from '../../storage/TokenStorage';

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-i18next', () => ({
    useTranslation: () => ({t: (k) => k}),
    initReactI18next: {type: '3rdParty', init: () => {}},
}));
jest.mock('../../view/components/common/ThemeContext', () => ({useTheme: () => ({loadThemeForRole: jest.fn()})}));
jest.mock('../../view/components/common/languageByRole', () => ({restoreLanguageForRole: jest.fn()}));
jest.mock('../../storage/TokenStorage', () => ({saveToken: jest.fn(async () => true), removeToken: jest.fn()}));
jest.mock('../../services/consentService', () => ({ConsentService: {ensureAccepted: jest.fn(async () => {})}}));
jest.mock('../../services/termsService', () => ({
    ...jest.requireActual('../../services/termsService'),
    TermsService: {gateFor: jest.fn(), accept: jest.fn()},
}));
jest.mock('../../services/AuthService', () => ({
    AuthService: {login: jest.fn()},
    authError: (code, message) => Object.assign(new Error(message), {code}),
}));

const ENABLED = {gate: 'NONE', step: 'NONE', minor: false};
const ADULT_FIRST_LOGIN = {gate: 'ACCEPT', step: 'TERMS', minor: false};
const MINOR_NO_GUARDIAN = {gate: 'BLOCKED', step: 'GUARDIAN', minor: true};
const MINOR_TERMS_PENDING = {gate: 'BLOCKED', step: 'TERMS', minor: true};
const MINOR_ENABLED = {gate: 'NONE', step: 'NONE', minor: true};

async function signIn(onLogin) {
    AuthService.login.mockResolvedValue({
        token: 's-1',
        mustChangePassword: false,
        user: {user_id: 'u-1', person_id: 'p-1', email: 'a@sede.edu.co', roles: ['STUDENT']},
    });
    let vm;
    function Probe() {
        vm = useLoginViewModel({onLogin});
        return null;
    }
    act(() => {
        TestRenderer.create(<Probe />);
    });
    act(() => {
        vm.setEmail('a@sede.edu.co');
        vm.setPassword('Secret-123');
    });
    await act(async () => {
        await vm.submit();
    });
    return () => vm;
}

beforeEach(() => jest.clearAllMocks());

test('an adult on the first login must sign the terms before entering', async () => {
    TermsService.gateFor.mockResolvedValue(ADULT_FIRST_LOGIN);
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    expect(vm().termsGate).toMatchObject({gate: 'ACCEPT', personId: 'p-1'});
    expect(onLogin).not.toHaveBeenCalled();
    expect(ConsentService.ensureAccepted).not.toHaveBeenCalled();
});

test('signing records the terms once and then the adult enters', async () => {
    TermsService.gateFor.mockResolvedValue(ADULT_FIRST_LOGIN);
    TermsService.accept.mockResolvedValue({});
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    await act(async () => {
        await vm().acceptTerms();
    });

    expect(TermsService.accept).toHaveBeenCalledTimes(1);
    expect(TermsService.accept).toHaveBeenCalledWith('p-1');
    expect(ConsentService.ensureAccepted).toHaveBeenCalledWith('p-1');
    expect(onLogin).toHaveBeenCalledWith('Aprendiz', 's-1');
    expect(vm().termsGate).toBeNull();
});

test('an error signing the terms is shown and the adult does not enter', async () => {
    TermsService.gateFor.mockResolvedValue(ADULT_FIRST_LOGIN);
    TermsService.accept.mockRejectedValue(new Error('Sin conexión'));
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    await act(async () => {
        await vm().acceptTerms();
    });

    expect(vm().termsError).toBe('Sin conexión');
    expect(vm().termsGate).not.toBeNull();
    expect(onLogin).not.toHaveBeenCalled();
});

test('an adult who already signed the current terms is not asked again', async () => {
    TermsService.gateFor.mockResolvedValue(ENABLED);
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    expect(vm().termsGate).toBeNull();
    expect(TermsService.accept).not.toHaveBeenCalled();
    expect(onLogin).toHaveBeenCalledWith('Aprendiz', 's-1');
});

test('a minor without a guardian is blocked on the guardian step and cannot sign for themself', async () => {
    TermsService.gateFor.mockResolvedValue(MINOR_NO_GUARDIAN);
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    expect(vm().termsGate).toMatchObject({gate: 'BLOCKED', step: 'GUARDIAN'});
    expect(onLogin).not.toHaveBeenCalled();

    await act(async () => {
        await vm().acceptTerms();
    });
    expect(TermsService.accept).not.toHaveBeenCalled();
});

test('a minor with a guardian and pending terms is blocked on the terms step', async () => {
    TermsService.gateFor.mockResolvedValue(MINOR_TERMS_PENDING);
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    expect(vm().termsGate).toMatchObject({gate: 'BLOCKED', step: 'TERMS'});
    expect(onLogin).not.toHaveBeenCalled();
    expect(ConsentService.ensureAccepted).not.toHaveBeenCalled();
});

test('a blocked minor enters after the administrator completes the registration', async () => {
    TermsService.gateFor.mockResolvedValueOnce(MINOR_TERMS_PENDING).mockResolvedValue(MINOR_ENABLED);
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    await act(async () => {
        await vm().recheckTerms();
    });

    expect(onLogin).toHaveBeenCalledWith('Aprendiz', 's-1');
    expect(vm().termsGate).toBeNull();
});

test('a fully enabled minor enters without accepting anything for themself', async () => {
    TermsService.gateFor.mockResolvedValue(MINOR_ENABLED);
    const onLogin = jest.fn();
    await signIn(onLogin);

    expect(onLogin).toHaveBeenCalledWith('Aprendiz', 's-1');
    expect(TermsService.accept).not.toHaveBeenCalled();
    expect(ConsentService.ensureAccepted).not.toHaveBeenCalled();
});

test('first login shows the terms once; a later login enters without them', async () => {
    // identity con estado: pide los términos hasta que la persona los firma.
    let signed = false;
    TermsService.gateFor.mockImplementation(async () => (signed ? ENABLED : ADULT_FIRST_LOGIN));
    TermsService.accept.mockImplementation(async () => {
        signed = true;
    });

    const firstLogin = jest.fn();
    const first = await signIn(firstLogin);
    expect(first().termsGate).toMatchObject({gate: 'ACCEPT'});
    expect(firstLogin).not.toHaveBeenCalled();
    await act(async () => {
        await first().acceptTerms();
    });
    expect(firstLogin).toHaveBeenCalledWith('Aprendiz', 's-1');

    const laterLogin = jest.fn();
    const later = await signIn(laterLogin);
    expect(later().termsGate).toBeNull();
    expect(laterLogin).toHaveBeenCalledWith('Aprendiz', 's-1');
    expect(TermsService.accept).toHaveBeenCalledTimes(1);
});

test('if the terms cannot be verified the person does not enter and the session is discarded', async () => {
    TermsService.gateFor.mockRejectedValue(Object.assign(new Error('offline'), {code: 'TERMS_UNAVAILABLE'}));
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    expect(onLogin).not.toHaveBeenCalled();
    expect(vm().termsGate).toBeNull();
    expect(vm().error).toBe('termsGate.unavailable');
    expect(removeToken).toHaveBeenCalled();
});

test('leaving the gate discards the session saved to sign', async () => {
    TermsService.gateFor.mockResolvedValue(MINOR_NO_GUARDIAN);
    const vm = await signIn(jest.fn());

    await act(async () => {
        await vm().leaveTermsGate();
    });

    expect(removeToken).toHaveBeenCalled();
    expect(vm().termsGate).toBeNull();
});
