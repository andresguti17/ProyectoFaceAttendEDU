// Ley 1581 + contraseña inicial: mientras la sesión exige el cambio de clave, el gateway
// rechaza escrituras, así que la aceptación del aviso se registra después del cambio.
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useLoginViewModel} from '../useLoginViewModel';
import {AuthService} from '../../services/AuthService';
import {ConsentService} from '../../services/consentService';

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
    TermsService: {gateFor: jest.fn(async () => ({gate: 'NONE', step: 'NONE', minor: false})), accept: jest.fn()},
}));
jest.mock('../../services/AuthService', () => ({
    AuthService: {login: jest.fn()},
    authError: (code, message) => Object.assign(new Error(message), {code}),
}));

function session(mustChangePassword) {
    return {
        token: 's-1',
        mustChangePassword,
        user: {user_id: 'u-1', person_id: 'p-1', email: 'a@sede.edu.co', roles: ['ADMIN']},
    };
}

async function signIn(onLogin) {
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
        vm.setPassword('Initial-Secret-1');
    });
    await act(async () => {
        await vm.submit();
    });
    return () => vm;
}

beforeEach(() => jest.clearAllMocks());

test('with an initial password, consent waits for the password change', async () => {
    AuthService.login.mockResolvedValue(session(true));
    const onLogin = jest.fn();
    const vm = await signIn(onLogin);

    expect(ConsentService.ensureAccepted).not.toHaveBeenCalled();
    expect(onLogin).not.toHaveBeenCalled();

    await act(async () => {
        await vm().onForcedPasswordChanged();
    });
    expect(ConsentService.ensureAccepted).toHaveBeenCalledWith('p-1');
    expect(onLogin).toHaveBeenCalledWith('Administrador', 's-1');
});

test('a normal login records consent before entering', async () => {
    AuthService.login.mockResolvedValue(session(false));
    const onLogin = jest.fn();
    await signIn(onLogin);

    expect(ConsentService.ensureAccepted).toHaveBeenCalledWith('p-1');
    expect(onLogin).toHaveBeenCalledWith('Administrador', 's-1');
});
