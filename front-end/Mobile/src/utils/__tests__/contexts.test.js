import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {UserProvider, useUser} from '../UserContext';
import {AlertsConfigProvider, useAlertsConfig} from '../AlertsConfigContext';
import {useAlertState} from '../useAlertState';
import {useInitializeUserTheme} from '../useInitializeUserTheme';
import {getCurrentUser, getCurrentUserRole} from '../../services/UserService';
import {renderHook, flush} from '../../viewmodels/__tests__/support/renderHook';

jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn()}));
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {loadThemeForRole: jest.fn()};
    return {useTheme: () => theme};
});

async function inProvider(Provider, useValue) {
    let latest;
    function Probe() {
        latest = useValue();
        return null;
    }
    await act(async () => {
        TestRenderer.create(<Provider><Probe /></Provider>);
    });
    await flush();
    return () => latest;
}

beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await AsyncStorage.clear();
});

describe('UserProvider', () => {
    test('loads the stored user and derives the role flags', async () => {
        getCurrentUserRole.mockResolvedValue('Instructor');
        getCurrentUser.mockResolvedValue({userId: 'u-1'});
        await AsyncStorage.setItem('userEmail', 'a@x.co');

        const ctx = await inProvider(UserProvider, useUser);

        expect(ctx()).toMatchObject({userRole: 'Instructor', userEmail: 'a@x.co', currentUser: {userId: 'u-1'}, isTeacher: true, isAdmin: false, isStudent: false});
        expect(ctx().faceUpdateUnlocked).toBe(false);
        act(() => ctx().unlockFaceUpdate());
        expect(ctx().faceUpdateUnlocked).toBe(true);
    });

    test('a storage failure leaves the user empty', async () => {
        getCurrentUserRole.mockRejectedValue(new Error('storage'));

        const ctx = await inProvider(UserProvider, useUser);

        expect(ctx().userRole).toBeNull();
        expect(ctx().isLoadingUser).toBe(false);
    });

    test('useUser outside the provider fails loudly', async () => {
        await expect(renderHook(useUser)).rejects.toThrow('useUser debe ser usado dentro de UserProvider');
    });
});

describe('AlertsConfigProvider', () => {
    test('merges the saved config over the defaults and persists toggles', async () => {
        await AsyncStorage.setItem('alertsConfig', JSON.stringify({enableWarning: false}));

        const ctx = await inProvider(AlertsConfigProvider, useAlertsConfig);

        expect(ctx().isAlertEnabled('warning')).toBe(false);
        expect(ctx().isAlertEnabled('success')).toBe(true);

        await act(async () => {
            ctx().toggleAlertType('success');
        });
        await flush();
        expect(ctx().isAlertEnabled('success')).toBe(false);
        expect(JSON.parse(await AsyncStorage.getItem('alertsConfig')).enableSuccess).toBe(false);
    });

    test('a corrupt saved config keeps the defaults', async () => {
        await AsyncStorage.setItem('alertsConfig', '{nope');

        const ctx = await inProvider(AlertsConfigProvider, useAlertsConfig);

        expect(ctx().isLoading).toBe(false);
        expect(ctx().isAlertEnabled('error')).toBe(true);
    });

    test('useAlertsConfig outside the provider fails loudly', async () => {
        await expect(renderHook(useAlertsConfig)).rejects.toThrow('useAlertsConfig debe ser usado dentro de AlertsConfigProvider');
    });
});

describe('useAlertState', () => {
    test('each kind of alert carries its type, title and callback, and clear resets it', async () => {
        const {result} = await renderHook(useAlertState);
        const done = jest.fn();

        act(() => result().showError('Falló', 'Error', done));
        expect(result().alertData).toMatchObject({message: 'Falló', type: 'error', title: 'Error', callback: done});
        act(() => result().showSuccess('Listo'));
        expect(result().alertData.type).toBe('success');
        act(() => result().showWarning('Ojo'));
        expect(result().alertData.type).toBe('warning');

        act(() => result().clearAlert());
        expect(result().alertData).toEqual({message: null, type: 'warning', timestamp: 0});
    });
});

describe('useInitializeUserTheme', () => {
    test('applies the theme of the stored role', async () => {
        getCurrentUserRole.mockResolvedValue('Aprendiz');

        const {result} = await renderHook(useInitializeUserTheme);
        await flush();

        expect(result().userRole).toBe('Aprendiz');
        expect(result().isLoading).toBe(false);
    });

    test('a failure does not leave the screen loading', async () => {
        getCurrentUserRole.mockRejectedValue(new Error('storage'));

        const {result} = await renderHook(useInitializeUserTheme);
        await flush();

        expect(result().isLoading).toBe(false);
        expect(result().userRole).toBeNull();
    });
});
