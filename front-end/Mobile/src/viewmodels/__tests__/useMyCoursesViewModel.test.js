import {useMyCoursesViewModel} from '../useMyCoursesViewModel';
import {getCurrentUser, getCurrentUserRole} from '../../services/UserService';
import {ActorService} from '../../services/ActorService';
import {backendGet} from '../../api/backend';
import {renderHook, flush} from './support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k) => k};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('@react-navigation/native', () => {
    const {useEffect} = jest.requireActual('react');
    return {useFocusEffect: (cb) => useEffect(cb, [cb])};
});
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {colors: {}};
    return {useTheme: () => theme};
});
jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn()}));
jest.mock('../../services/ActorService', () => ({ActorService: {getByPerson: jest.fn()}}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));

const ROUTES = {
    'api/v1/academic-actors/10/enrollments': [
        {cohort_id: 7, enrollment_status: 'Active', enrolled_on: '2026-02-01'},
        {cohort_id: 8, enrollment_status: 'Withdrawn'},
        {cohort_id: 404, enrollment_status: 'Completed'},
    ],
    'api/v1/cohorts/7': [{cohort_id: 7, code: 'F-2901', program_id: 3}],
    'api/v1/cohorts/9': [{cohort_id: 9, code: 'F-3000', program_id: 3}],
    'api/v1/programs/3': [{name: 'ADSO'}],
    'api/v1/programs/3/courses': [{course_id: 1, code: 'C1', name: 'Bases de datos'}],
    'api/v1/cohorts/9/enrollments': [{}, {}, {}],
};

beforeEach(() => {
    jest.clearAllMocks();
    getCurrentUser.mockResolvedValue({personId: 'p-1'});
    backendGet.mockImplementation(async (_b, path, params) => {
        if (path === 'api/v1/schedule-blocks') return params.instructorActorId === 20 ? [{cohort_id: 9}, {cohort_id: 9}] : [];
        if (path in ROUTES) return ROUTES[path];
        throw new Error('404');
    });
});

async function load(role, actors) {
    getCurrentUserRole.mockResolvedValue(role);
    ActorService.getByPerson.mockResolvedValue(actors);
    const hook = await renderHook(useMyCoursesViewModel);
    await flush();
    return hook.result;
}

test('a learner sees its active and completed cohorts with program and courses', async () => {
    const vm = await load('Aprendiz', [{academicActorId: 20, actorTypeId: 2}, {academicActorId: 10, actorTypeId: 1}]);

    expect(vm().role).toBe('student');
    // Withdrawn queda fuera; la ficha 404 no carga y se descarta sin romper la lista.
    expect(vm().fichas).toEqual([{
        cohortId: 7, cohortCode: 'F-2901', programName: 'ADSO',
        courses: [{courseId: 1, code: 'C1', name: 'Bases de datos'}],
        enrolledOn: '2026-02-01', enrollmentStatus: 'Active',
    }]);
    expect(vm().loading).toBe(false);
});

test('an instructor sees each cohort it teaches once, with its learner count', async () => {
    const vm = await load('Instructor', [{academicActorId: 10, actorTypeId: 1}, {academicActorId: 20, actorTypeId: 2}]);

    expect(vm().role).toBe('teacher');
    expect(vm().fichas).toHaveLength(1);
    expect(vm().fichas[0]).toMatchObject({cohortId: 9, cohortCode: 'F-3000', studentsCount: 3});
});

test('a stored role list resolves to its highest role', async () => {
    const vm = await load(JSON.stringify(['INSTRUCTOR']), [{academicActorId: 20, actorTypeId: 2}]);

    expect(vm().role).toBe('teacher');
});

test('without an academic actor there is nothing to show', async () => {
    const vm = await load('Aprendiz', []);

    expect(vm().fichas).toEqual([]);
    expect(vm().error).toBeNull();
});

test('a failure loading the user shows the error', async () => {
    getCurrentUserRole.mockResolvedValue('Aprendiz');
    getCurrentUser.mockRejectedValue(new Error('storage'));
    const hook = await renderHook(useMyCoursesViewModel);
    await flush();

    expect(hook.result().error).toBe('courses.loadError');
});
