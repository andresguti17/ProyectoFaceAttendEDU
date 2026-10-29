import {useDashboardViewModel} from '../useDashboardViewModel';
import {getCurrentUser, getCurrentUserRole, isSuperAdmin} from '../../services/UserService';
import {ActorService} from '../../services/ActorService';
import {backendGet} from '../../api/backend';
import {loadScopedAlerts} from '../../services/alertFeed';
import {renderHook, flush, act} from './support/renderHook';

// Referencias estables, como en la app: t y loadThemeForRole son dependencias de los efectos.
jest.mock('react-i18next', () => {
    const translation = {t: (k) => k, i18n: {language: 'es'}};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('@react-navigation/native', () => {
    const {useEffect} = jest.requireActual('react');
    return {useFocusEffect: (cb) => useEffect(cb, [cb])};
});
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {colors: {categorical: ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']}, loadThemeForRole: jest.fn(), toggleTheme: jest.fn(), theme: 'light'};
    return {useTheme: () => theme};
});
jest.mock('../../utils/useLanguageRefresh', () => ({useLanguageRefresh: () => 0}));
jest.mock('../../services/UserService', () => ({
    getCurrentUser: jest.fn(),
    getCurrentUserRole: jest.fn(),
    isSuperAdmin: jest.fn(async () => false),
}));
jest.mock('../../services/ActorService', () => ({ActorService: {getByPerson: jest.fn()}}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));
jest.mock('../../services/alertFeed', () => ({loadScopedAlerts: jest.fn(async () => [])}));

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** backendGet simulado por ruta; los parámetros llegan al manejador. */
function backend(routes) {
    backendGet.mockImplementation(async (_base, path, params) => {
        const handler = routes[path];
        if (handler === undefined) return [];
        return typeof handler === 'function' ? handler(params) : handler;
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getCurrentUser.mockResolvedValue({userId: 'u-1', personId: 'p-1', email: 'a@sena.edu.co'});
    getCurrentUserRole.mockResolvedValue(null);
    isSuperAdmin.mockResolvedValue(false);
    ActorService.getByPerson.mockResolvedValue([{academicActorId: 50, schoolId: 2}]);
    loadScopedAlerts.mockResolvedValue([]);
});

let mounted;
afterEach(() => mounted?.unmount());

async function load(props) {
    mounted = await renderHook(useDashboardViewModel, props);
    await flush();
    await flush();
    await flush();
    return mounted.result;
}

test('the admin dashboard counts today\'s records and the instructors who opened a class today', async () => {
    backend({
        'api/v1/attendance-records': [
            {attendance_record_id: 1, attendance_status: 'Present', captured_at: `${today()}T13:00:00Z`},
            {attendance_record_id: 2, attendance_status: 'Late', captured_at: `${today()}T13:20:00Z`},
            {attendance_record_id: 3, attendance_status: 'Absent', captured_at: null},
            {attendance_record_id: 4, attendance_status: 'Present', captured_at: '2020-01-01T13:00:00Z'},
        ],
        'api/v1/academic-actors': [{actor_type_id: 2}, {actor_type_id: 2}, {actor_type_id: 1}],
        'api/v1/class-sessions': [
            {session_date: today(), opened_by: 9},
            {session_date: today(), opened_by: 9},
            {session_date: '2020-01-01', opened_by: 8},
        ],
    });
    isSuperAdmin.mockResolvedValue(true);

    const vm = await load({userRole: 'ADMIN'});

    // Hoy: 1 presente y 1 tarde de 2 capturas de hoy (la ausencia sin captura no cuenta como "hoy").
    expect(vm().adminStats).toEqual({totalEmpleados: 2, presentesHoy: 1, ausentesHoy: 0, tardanzasHoy: 1, porcentajeAsistencia: 50});
    expect(vm().attendance).toBe(50);
    expect(vm().asistenciasRecientes).toHaveLength(4);
    expect(vm().menuAcciones.some((m) => m.screen === 'Schools')).toBe(true);
    expect(backendGet).toHaveBeenCalledWith(expect.anything(), 'api/v1/attendance-records', {page: 1, limit: 200}, {useCache: true});
});

test('a school admin does not see the schools entry', async () => {
    backend({});

    const vm = await load({userRole: 'administrador'});

    expect(vm().isAdmin).toBe(true);
    expect(vm().menuAcciones.some((m) => m.screen === 'Schools')).toBe(false);
});

test('the instructor dashboard walks its blocks, sessions and records with camelCase filters', async () => {
    backend({
        'api/v1/schedule-blocks': (p) => (p.instructorActorId === 50 ? [{schedule_block_id: 7}] : []),
        'api/v1/class-sessions': (p) => (p.scheduleBlockId === 7 ? [{class_session_id: 70, session_date: today()}] : []),
        'api/v1/attendance-records': (p) => (p.classSessionId === 70
            ? [
                {attendance_record_id: 1, attendance_status: 'Present', captured_at: `${today()}T13:00:00Z`},
                {attendance_record_id: 2, attendance_status: 'Absent', captured_at: null},
            ]
            : []),
        'api/v1/justifications': [{justification_id: 1}, {justification_id: 2}],
    });

    const vm = await load({userRole: 'INSTRUCTOR'});

    expect(vm().isTeacher).toBe(true);
    expect(vm().teacherStats).toEqual({presentesHoy: 1, totalEstudiantes: 1, clasesImpartidasHoy: 1, justificacionesPendientes: 2, porcentajeAsistencia: 100});
    expect(vm().menuAcciones.some((m) => m.screen === 'PendingJustificationScreen')).toBe(true);
});

test('a failing list does not blank the instructor dashboard', async () => {
    backendGet.mockRejectedValue(new Error('timeout'));

    const vm = await load({userRole: 'teacher'});

    expect(vm().teacherStats.porcentajeAsistencia).toBe(0);
    expect(vm().teacherStats.clasesImpartidasHoy).toBe(0);
});

test('the learner dashboard shows its own attendance and course names', async () => {
    backend({
        'api/v1/attendance-records': (p) => (p.academicActorId === 50
            ? [
                {attendance_record_id: 1, attendance_status: 'Present', class_session_id: 70, captured_at: '2026-10-27T13:00:00Z'},
                {attendance_record_id: 2, attendance_status: 'Late', class_session_id: 70, captured_at: '2026-10-28T13:20:00Z'},
                {attendance_record_id: 3, attendance_status: 'Absent', class_session_id: 70, captured_at: null},
            ]
            : []),
        'api/v1/class-sessions/70': [{schedule_block_id: 7}],
        'api/v1/schedule-blocks/7': [{course_id: 3}],
        'api/v1/courses/3': [{name: 'Programación'}],
    });
    loadScopedAlerts.mockResolvedValue([{id: 1, title: 'Ausencia', person: 'Ana', raisedAt: new Date().toISOString(), resolved: false}]);

    const vm = await load({userRole: 'STUDENT'});

    expect(vm().studentStats).toEqual({miAsistencia: 33, totalClases: 3, clasesAsistidas: 1, faltas: 1, retardos: 1});
    expect(vm().misRegistrosRecientes[0]).toMatchObject({id: 3, materia: 'Programación', hora: '—', fecha: '—'});
    expect(vm().novedades[0]).toMatchObject({id: 1, titulo: 'Ausencia', tipo: 'warning'});
    expect(vm().menuAcciones.some((m) => m.screen === 'RegisterFace')).toBe(true);
});

test('the role comes from storage when not passed, including a stored role list', async () => {
    getCurrentUserRole.mockResolvedValue(JSON.stringify(['STUDENT']));
    backend({});

    const vm = await load({});

    expect(vm().userRole).toBeTruthy();
    expect(vm().isAdmin).toBe(false);
});

test('logout shows the spinner and survives a failing logout', async () => {
    backend({});
    const onLogout = jest.fn().mockRejectedValue(new Error('offline'));
    const vm = await load({userRole: 'ADMIN', onLogout});

    await act(async () => {
        await vm().handleLogoutPress();
    });

    expect(onLogout).toHaveBeenCalled();
    expect(vm().isLoading).toBe(false);
});
