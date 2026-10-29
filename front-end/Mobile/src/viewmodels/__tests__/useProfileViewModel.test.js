import AsyncStorage from '@react-native-async-storage/async-storage';
import {useProfileViewModel} from '../useProfileViewModel';
import {getCurrentUser, getCurrentUserRole} from '../../services/UserService';
import {ActorService} from '../../services/ActorService';
import {SchoolService} from '../../services/SchoolService';
import {PeriodService} from '../../services/PeriodService';
import {backendGet} from '../../api/backend';
import {removeToken} from '../../storage/TokenStorage';
import {saveLanguageForRole} from '../../view/components/common/languageByRole';
import {loadStudentProfileSections, loadTeacherProfileSections} from '../../services/profileData';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k) => k, i18n: {language: 'es'}};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('@react-navigation/native', () => {
    const {useEffect} = jest.requireActual('react');
    const navigation = {goBack: jest.fn()};
    return {useFocusEffect: (cb) => useEffect(cb, [cb]), useNavigation: () => navigation};
});
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {theme: 'light', toggleTheme: jest.fn(), loadThemeForRole: jest.fn()};
    return {useTheme: () => theme};
});
jest.mock('../../view/components/common/languageByRole', () => ({saveLanguageForRole: jest.fn()}));
jest.mock('../../utils/useLanguageRefresh', () => ({useLanguageRefresh: () => 0}));
jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn()}));
jest.mock('../../services/ActorService', () => ({ActorService: {getByPerson: jest.fn(), getAll: jest.fn()}}));
jest.mock('../../services/SchoolService', () => ({SchoolService: {getById: jest.fn(), getAll: jest.fn()}}));
jest.mock('../../services/PeriodService', () => ({PeriodService: {getActiveBySchool: jest.fn()}}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));
jest.mock('../../storage/TokenStorage', () => ({removeToken: jest.fn()}));
jest.mock('../../services/profileData', () => ({
    loadStudentProfileSections: jest.fn(async () => ({courses: [{id_course: 1}], attendanceStats: {present: 3}, justifications: []})),
    loadTeacherProfileSections: jest.fn(async () => ({teacherSchedules: [{id_schedule: 1}], teacherCourseStats: []})),
}));

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getCurrentUser.mockResolvedValue({userId: 'u-1', personId: 'p-1', email: 'stored@x.co', username: 'ana'});
    backendGet.mockImplementation(async (_b, path) => {
        if (path === 'api/v1/persons/p-1') return [{person_id: 'p-1', name: 'Ana', last_name: 'Pérez', email: 'ana@x.co', phone: '300', document_number: '123'}];
        if (path === 'api/v1/users/u-1') return [{created_at: '2025-01-15T00:00:00Z'}];
        return [];
    });
    SchoolService.getById.mockResolvedValue({schoolId: 2, name: 'Sede Norte', address: 'Calle 1'});
    PeriodService.getActiveBySchool.mockResolvedValue({name: '2026-II'});
});

async function load(role, actors, props = {}) {
    getCurrentUserRole.mockResolvedValue(role);
    ActorService.getByPerson.mockResolvedValue(actors);
    const hook = await renderHook(useProfileViewModel, props);
    await flush();
    return hook.result;
}

test('a learner profile shows the person, the actor of its role, the school with its active period and the learner sections', async () => {
    const vm = await load('Aprendiz', [
        {academicActorId: 20, actorTypeId: 2, schoolId: 9, actorCode: 'I-20'},
        {academicActorId: 10, actorTypeId: 1, schoolId: 2, actorCode: 'A-10', startedOn: '2026-02-01'},
    ]);

    expect(vm().userInfo).toMatchObject({name: 'Ana Pérez', email: 'ana@x.co', phone: '300', employeeId: '123', actorCode: 'A-10', school: 'Sede Norte', role: 'Aprendiz'});
    expect(vm().userInfo.joinDate).toMatch(/2026/);
    expect(vm().schoolInfo).toEqual({name: 'Sede Norte', address: 'Calle 1', activePeriod: '2026-II'});
    expect(loadStudentProfileSections).toHaveBeenCalledWith(10);
    expect(vm().courses).toEqual([{id_course: 1}]);
    expect(vm().iotDevices).toEqual([]);
});

test('an instructor profile loads the instructor sections with its own actor', async () => {
    const vm = await load('Instructor', [{academicActorId: 10, actorTypeId: 1, schoolId: 2}, {academicActorId: 20, actorTypeId: 2, schoolId: 2}]);

    expect(loadTeacherProfileSections).toHaveBeenCalledWith(20, expect.any(Function));
    expect(loadTeacherProfileSections.mock.calls[0][1](1)).toMatch(/lunes/i);
    expect(vm().teacherSchedules).toEqual([{id_schedule: 1}]);
});

test('an admin without an actor gets the school with most actors and the account creation date', async () => {
    SchoolService.getAll.mockResolvedValue([{schoolId: 1, name: 'Sede A'}, {schoolId: 2, name: 'Sede B'}]);
    ActorService.getAll.mockResolvedValue([{schoolId: 2}, {schoolId: 2}, {schoolId: 1}]);

    const vm = await load('Administrador', [{academicActorId: null, schoolId: null}]);

    expect(vm().userInfo.school).toBe('Sede B');
    expect(vm().userInfo.joinDate).toMatch(/2025/);
    expect(PeriodService.getActiveBySchool).toHaveBeenCalledWith(2);
    expect(vm().courses).toEqual([]);
    expect(loadStudentProfileSections).not.toHaveBeenCalled();
});

test('when the person cannot be read the stored account data fills the profile', async () => {
    backendGet.mockRejectedValue(new Error('503'));

    const vm = await load('Aprendiz', []);

    expect(vm().userInfo).toMatchObject({name: 'ana', email: 'stored@x.co', personId: 'p-1', school: ''});
    expect(vm().schoolInfo).toBeNull();
});

test('logout saves the language, clears the session and hands over to the navigator', async () => {
    const onLogout = jest.fn();
    const vm = await load('Aprendiz', [], {onLogout});
    await AsyncStorage.setItem('userRole', 'Aprendiz');

    await act(async () => {
        await vm().performLogout();
    });

    expect(saveLanguageForRole).toHaveBeenCalledWith('Aprendiz', 'es');
    expect(removeToken).toHaveBeenCalled();
    expect(await AsyncStorage.getItem('userRole')).toBeNull();
    expect(onLogout).toHaveBeenCalled();
    expect(vm().isLoading).toBe(false);
});

test('a failing logout is rethrown so the screen can show it', async () => {
    removeToken.mockRejectedValueOnce(new Error('keystore'));
    const vm = await load('Aprendiz', []);

    let thrown;
    await act(async () => {
        thrown = await vm().performLogout().catch((e) => e);
    });

    expect(thrown.message).toBe('keystore');
    expect(vm().isLoading).toBe(false);
});
