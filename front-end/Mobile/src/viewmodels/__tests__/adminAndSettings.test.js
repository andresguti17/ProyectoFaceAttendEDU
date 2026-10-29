// Ajustes (apariencia, idioma), menú, novedades y pantallas de administración del móvil.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAppearanceSettingsViewModel} from '../useAppearanceSettingsViewModel';
import {useLanguageSettingsViewModel} from '../useLanguageSettingsViewModel';
import {useMenuViewModel} from '../useMenuViewModel';
import {useManageEnvironmentViewModel} from '../useManageEnvironmentViewModel';
import {useNewsViewModel} from '../useNewsViewModel';
import {useBiometricCasesViewModel} from '../useBiometricCasesViewModel';
import {useSchoolsViewModel} from '../useSchoolsViewModel';
import {getCurrentUser, getCurrentUserRole, isSuperAdmin} from '../../services/UserService';
import {EnvironmentService} from '../../services/EnvironmentService';
import {SchoolService} from '../../services/SchoolService';
import {AlertService} from '../../services/AlertService';
import {loadScopedAlerts} from '../../services/alertFeed';
import {BiometricCaseService} from '../../services/BiometricCaseService';
import {getPersonCached} from '../../services/JustificationService';
import {saveLanguageForRole} from '../../view/components/common/languageByRole';
import {removeToken} from '../../storage/TokenStorage';
import {backendGet} from '../../api/backend';
import {hexToHsl} from '../../utils/colorUtils';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('react-i18next', () => {
    const i18n = {language: 'es', changeLanguage: jest.fn(async (l) => { i18n.language = l; })};
    const translation = {t: (k) => k, i18n};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}, __i18n: i18n};
});
jest.mock('@react-navigation/native', () => {
    const {useEffect} = jest.requireActual('react');
    const mockNavigation = {goBack: jest.fn(), navigate: jest.fn()};
    return {useFocusEffect: (cb) => useEffect(cb, [cb]), useNavigation: () => mockNavigation, __navigation: mockNavigation};
});
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {
        theme: 'light', accentColor: '#3366CC', paletteMode: 'normal', colors: {},
        loadThemeForRole: jest.fn(), setThemeForRole: jest.fn(), setAccentForRole: jest.fn(), setPaletteForRole: jest.fn(async () => true),
    };
    return {useTheme: () => theme, __theme: theme};
});
jest.mock('../../view/components/common/languageByRole', () => ({saveLanguageForRole: jest.fn()}));
jest.mock('../../utils/useLanguageRefresh', () => ({useLanguageRefresh: () => 0}));
const mockAlerts = {alertConfig: {}, hideAlert: jest.fn(), showError: jest.fn(), showConfirm: jest.fn()};
jest.mock('../../view/components/common/useCustomAlert', () => ({useCustomAlert: () => mockAlerts}));
jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn(), isSuperAdmin: jest.fn(async () => false)}));
jest.mock('../../services/EnvironmentService', () => ({EnvironmentService: {getBySchool: jest.fn(), getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn()}}));
jest.mock('../../services/SchoolService', () => ({SchoolService: {getCurrentSchoolId: jest.fn()}}));
jest.mock('../../services/AlertService', () => ({AlertService: {markResolved: jest.fn()}}));
jest.mock('../../services/alertFeed', () => ({loadScopedAlerts: jest.fn()}));
jest.mock('../../services/BiometricCaseService', () => ({BiometricCaseService: {getAll: jest.fn(), review: jest.fn()}}));
jest.mock('../../services/JustificationService', () => ({getPersonCached: jest.fn()}));
jest.mock('../../storage/TokenStorage', () => ({removeToken: jest.fn()}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));

const {__navigation: navigation} = jest.requireMock('@react-navigation/native');
const {__theme: theme} = jest.requireMock('../../view/components/common/ThemeContext');
const {__i18n: i18n} = jest.requireMock('react-i18next');

beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await AsyncStorage.clear();
    i18n.language = 'es';
    theme.setPaletteForRole.mockResolvedValue(true);
    getCurrentUserRole.mockResolvedValue('Administrador');
});

describe('apariencia', () => {
    test('starts from the role accent and saves theme, accent and palette for the role', async () => {
        const {result} = await renderHook(useAppearanceSettingsViewModel);
        await flush();
        expect(result().currentHex.toUpperCase()).toBe('#3366CC');

        act(() => result().setSelectedTheme('dark'));
        act(() => result().handleHexInput('#FF0000'));
        act(() => result().handleHexInput('rojo')); // ignorado
        await act(async () => result().handleSave());

        expect(theme.setThemeForRole).toHaveBeenCalledWith('Administrador', 'dark');
        expect(theme.setAccentForRole.mock.calls[0][1].toUpperCase()).toBe('#FF0000');
        expect(theme.setPaletteForRole).toHaveBeenCalledWith('Administrador', 'normal');
        expect(result().alertData).toMatchObject({message: 'settings.appearanceSaved', type: 'success'});
    });

    test('a preset moves the HSL sliders', async () => {
        const {result} = await renderHook(useAppearanceSettingsViewModel);

        act(() => result().applyPreset({color: '#00AA55'}));

        expect([result().hue, result().sat, result().lum]).toEqual(hexToHsl('#00AA55').map(Math.round));
    });

    test('a palette that cannot be saved, or no role, is an error', async () => {
        theme.setPaletteForRole.mockResolvedValue(false);
        const {result} = await renderHook(useAppearanceSettingsViewModel);
        await act(async () => result().handleSave());
        expect(result().alertData.message).toBe('settings.errorSavingAppearance');

        getCurrentUserRole.mockResolvedValue(null);
        await act(async () => result().handleSave());
        expect(result().alertData.message).toBe('settings.noRoleError');

        act(() => result().clearAlert());
        expect(result().alertData.message).toBeNull();
    });
});

describe('idioma', () => {
    test('changing the language applies it and saves it for the role', async () => {
        const {result} = await renderHook(useLanguageSettingsViewModel);

        act(() => result().setSelectedLanguage('pt'));
        await act(async () => result().handleSave());

        expect(i18n.changeLanguage).toHaveBeenCalledWith('pt');
        expect(saveLanguageForRole).toHaveBeenCalledWith('Administrador', 'pt');
        expect(result().alertData).toMatchObject({message: 'settings.languageChanged', type: 'success'});
        expect(result().languages.map((l) => l.code)).toEqual(['es', 'en', 'fr', 'pt']);
    });

    test('without a role nothing is changed', async () => {
        getCurrentUserRole.mockResolvedValue(null);
        const {result} = await renderHook(useLanguageSettingsViewModel);

        await act(async () => result().handleSave());

        expect(saveLanguageForRole).not.toHaveBeenCalled();
        expect(result().alertData.type).toBe('error');
    });

    test('a failure saving is reported', async () => {
        saveLanguageForRole.mockRejectedValueOnce(new Error('storage'));
        const {result} = await renderHook(useLanguageSettingsViewModel);

        await act(async () => result().handleSave());

        expect(result().alertData.message).toBe('settings.errorChangingLanguage');
        expect(result().isLoading).toBe(false);
    });
});

describe('menú', () => {
    test('resolves the highest of a stored role list and restores the saved language', async () => {
        getCurrentUserRole.mockResolvedValue(JSON.stringify(['STUDENT', 'ADMIN']));
        isSuperAdmin.mockResolvedValue(true);
        await AsyncStorage.setItem('appLanguage', 'en');

        const {result} = await renderHook(useMenuViewModel, {});
        await flush();

        expect(result()).toMatchObject({userRole: 'Administrador', isAdmin: true, isSuperAdmin: true});
        expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
        act(() => result().navigateTo('Profile'));
        expect(navigation.navigate).toHaveBeenCalledWith('Profile');
    });

    test('logout clears only the session and hands over', async () => {
        const onLogout = jest.fn();
        await AsyncStorage.multiSet([['userRole', 'Aprendiz'], ['userEmail', 'a@x.co'], ['appTheme', 'dark']]);
        const {result} = await renderHook(useMenuViewModel, {onLogout});

        await act(async () => result().handleLogout());

        expect(await AsyncStorage.getItem('userRole')).toBeNull();
        expect(await AsyncStorage.getItem('appTheme')).toBe('dark');
        expect(removeToken).toHaveBeenCalled();
        expect(onLogout).toHaveBeenCalled();
    });

    test('a failing logout is rethrown', async () => {
        removeToken.mockRejectedValueOnce(new Error('keystore'));
        const {result} = await renderHook(useMenuViewModel, {});

        let error;
        await act(async () => {
            error = await result().handleLogout().catch((e) => e);
        });
        expect(error.message).toBe('keystore');
    });
});

describe('ambientes', () => {
    beforeEach(() => {
        SchoolService.getCurrentSchoolId.mockResolvedValue(2);
        EnvironmentService.getBySchool.mockResolvedValue([{environmentId: 1, name: 'Sala 1', code: 'B-101', capacity: 30, status: true}, null]);
        EnvironmentService.getAll.mockResolvedValue([]);
    });

    test('lists the school rooms and searches by name or location', async () => {
        const {result} = await renderHook(useManageEnvironmentViewModel, true);
        await flush();

        expect(result().ambientes).toEqual([{id: '1', nombre: 'Sala 1', ubicacion: 'B-101', capacidad: 30, status: true}]);
        expect(result().searchAmbientes('b-1')).toHaveLength(1);
        expect(result().searchAmbientes('zzz')).toEqual([]);
        expect(result().searchAmbientes('')).toHaveLength(1);
    });

    test('create, update and delete go to the backend and reload', async () => {
        const {result} = await renderHook(useManageEnvironmentViewModel, true);
        await flush();

        await act(async () => result().addAmbiente({nombre: ' Sala 2 ', ubicacion: ' B-102 ', capacidad: '25'}));
        expect(EnvironmentService.create.mock.calls[0][0]).toMatchObject({schoolId: 2, name: 'Sala 2', code: 'B-102', capacity: 25, status: true});

        await act(async () => result().updateAmbiente({id: '1', nombre: 'Sala 1', ubicacion: 'B-101', capacidad: '40', status: false}));
        expect(EnvironmentService.update.mock.calls[0]).toEqual(['1', expect.objectContaining({capacity: 40, status: false})]);

        await act(async () => result().deleteAmbiente('1'));
        expect(EnvironmentService.delete).toHaveBeenCalledWith('1');
        expect(EnvironmentService.getBySchool).toHaveBeenCalledTimes(4);
    });

    test('without a school a room cannot be created; without permission nothing loads', async () => {
        SchoolService.getCurrentSchoolId.mockResolvedValue(null);
        const {result} = await renderHook(useManageEnvironmentViewModel, true);
        await flush();
        expect(EnvironmentService.getAll).toHaveBeenCalled();

        let error;
        await act(async () => {
            error = await result().addAmbiente({nombre: 'X', ubicacion: 'Y', capacidad: '1'}).catch((e) => e);
        });
        expect(error.message).toBe('errors.missingSchool');

        jest.clearAllMocks();
        await renderHook(useManageEnvironmentViewModel, false);
        expect(SchoolService.getCurrentSchoolId).not.toHaveBeenCalled();
    });
});

describe('novedades', () => {
    beforeEach(() => {
        loadScopedAlerts.mockResolvedValue([
            {id: 1, title: '', code: 'JUSTIFICATION_APPROVED', raisedAt: '2026-10-28T10:00:00Z', resolved: false},
            {id: 2, title: 'Riesgo', code: 'AT_RISK', resolved: false},
        ]);
    });

    test('staff can resolve; the default title fills missing ones', async () => {
        getCurrentUserRole.mockResolvedValue('Instructor');
        AlertService.markResolved.mockResolvedValue({});
        const {result} = await renderHook(useNewsViewModel);
        await flush();

        expect(result().alerts[0].title).toBe('news.alert');
        expect(result().canResolve).toBe(true);
        await act(async () => result().resolve(2));
        expect(result().alerts.find((a) => a.id === 2).resolved).toBe(true);
        expect(result().canOpen(result().alerts[0])).toBe(false);
    });

    test('a learner opens its justification result from the alert', async () => {
        getCurrentUserRole.mockResolvedValue('Aprendiz');
        const {result} = await renderHook(useNewsViewModel);
        await flush();

        act(() => result().openAlert(result().alerts[0]));
        act(() => result().openAlert(result().alerts[1]));

        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('ValidJustifications', {reviewedAt: '2026-10-28T10:00:00Z'});
        expect(result().canResolve).toBe(false);
    });

    test('load and resolve failures are shown', async () => {
        AlertService.markResolved.mockRejectedValue(new Error('403'));
        const {result} = await renderHook(useNewsViewModel);
        await flush();
        await act(async () => result().resolve(1));
        expect(result().error).toBe('403');
        expect(result().resolvingId).toBeNull();

        loadScopedAlerts.mockRejectedValue(new Error('503'));
        await act(async () => result().reload());
        expect(result().error).toBe('news.loadError');
    });
});

describe('casos biométricos (revisión)', () => {
    beforeEach(() => {
        getCurrentUser.mockResolvedValue({userId: 'u-rev'});
        BiometricCaseService.getAll.mockResolvedValue([
            {caseId: 'c1', personId: 'p-1', isPending: true},
            {caseId: 'c2', personId: 'p-2', isInReview: true},
            {caseId: 'c3', personId: 'p-3', isPending: false, isInReview: false},
            null,
        ]);
        getPersonCached.mockImplementation(async (id) => (id === 'p-1' ? {name: 'Ana', last_name: 'Pérez'} : null));
    });

    test('only open cases are listed, with the person name or its id', async () => {
        const {result} = await renderHook(useBiometricCasesViewModel);
        await flush();

        expect(result().cases.map((c) => [c.caseId, c.personName])).toEqual([['c1', 'Ana Pérez'], ['c2', 'p-2']]);
    });

    test('approving asks for confirmation and removes the case; a review failure keeps it', async () => {
        BiometricCaseService.review.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('No puede revisar su propia solicitud'));
        const {result} = await renderHook(useBiometricCasesViewModel);
        await flush();

        act(() => result().approve(result().cases[0]));
        await act(async () => mockAlerts.showConfirm.mock.calls[0][2]());
        expect(BiometricCaseService.review).toHaveBeenCalledWith('c1', {updateStatus: 'Approved', reviewedBy: 'u-rev'});
        expect(result().cases.map((c) => c.caseId)).toEqual(['c2']);

        act(() => result().reject(result().cases[0]));
        await act(async () => mockAlerts.showConfirm.mock.calls[1][2]());
        expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', 'No puede revisar su propia solicitud');
        expect(result().cases).toHaveLength(1);
        expect(result().busyId).toBeNull();
    });

    test('a load failure is shown', async () => {
        BiometricCaseService.getAll.mockRejectedValue(new Error('403'));

        await renderHook(useBiometricCasesViewModel);
        await flush();

        expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', '403');
    });
});

describe('sedes', () => {
    test('lists every school with its program count', async () => {
        backendGet.mockImplementation(async (_b, path) => {
            if (path === 'api/v1/schools') return [{school_id: 1, code: 'N', name: 'Norte'}, {school_id: 2, name: 'Sur', status: false}, {}];
            if (path === 'api/v1/schools/1/programs') return [{}, {}];
            throw new Error('403');
        });

        const {result} = await renderHook(useSchoolsViewModel);
        await flush();

        expect(result().schools).toEqual([
            expect.objectContaining({schoolId: 1, code: 'N', name: 'Norte', status: true, programsCount: 2}),
            expect.objectContaining({schoolId: 2, name: 'Sur', status: false, programsCount: 0}),
        ]);
        expect(result().loading).toBe(false);
    });
});
