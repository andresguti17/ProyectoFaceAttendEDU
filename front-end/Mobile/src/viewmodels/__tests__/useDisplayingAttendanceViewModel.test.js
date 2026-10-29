import {Platform} from 'react-native';
import {useAttendanceViewModel, statusTokens, approvalTokens, getSubjectLabel, formatDateKey, resolveLocale, getDayLabel, formatDateDisplay} from '../useDisplayingAttendanceViewModel';
import {getCurrentUser, getCurrentUserRole} from '../../services/UserService';
import {ActorService} from '../../services/ActorService';
import {PeriodService} from '../../services/PeriodService';
import {JustificationService} from '../../services/JustificationService';
import {backendGet} from '../../api/backend';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: {language: 'es'}};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {colors: {}, loadThemeForRole: jest.fn(), theme: 'dark'};
    return {useTheme: () => theme};
});
jest.mock('../../utils/useLanguageRefresh', () => ({useLanguageRefresh: () => 0}));
jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn()}));
jest.mock('../../services/ActorService', () => ({ActorService: {getByPerson: jest.fn()}}));
jest.mock('../../services/PeriodService', () => ({PeriodService: {getActiveBySchool: jest.fn(), getAll: jest.fn()}}));
jest.mock('../../services/JustificationService', () => ({JustificationService: {getAll: jest.fn()}}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));

const RECORD = {attendance_record_id: 1, class_session_id: 70, academic_actor_id: 10, attendance_status: 'Late', captured_at: '2026-10-27T13:20:00Z'};
const ROUTES = {
    'api/v1/class-sessions/70': [{schedule_block_id: 7, session_date: '2026-10-27'}],
    'api/v1/academic-actors/10': [{person_id: 'p-10'}],
    'api/v1/schedule-blocks/7': [{course_id: 3, environment_id: 4, instructor_actor_id: 20, day_of_week: 2, starts_at: '07:00', ends_at: '09:00'}],
    'api/v1/persons/p-10': [{name: 'Ana', last_name: 'Pérez'}],
    'api/v1/courses/3': [{name: 'Bases de datos', code: 'BD1'}],
    'api/v1/environments/4': [{name: 'Sala 2'}],
    'api/v1/academic-actors/20': [{person_id: 'p-20'}],
    'api/v1/persons/p-20': [{name: 'Iván', last_name: 'Ruiz'}],
};

function backend(records) {
    backendGet.mockImplementation(async (_b, path, params) => {
        if (path === 'api/v1/attendance-records') return records(params);
        if (path === 'api/v1/schedule-blocks') return params?.instructorActorId === 20 ? [{schedule_block_id: 7}] : [];
        if (path === 'api/v1/class-sessions') return params?.scheduleBlockId === 7 ? [{class_session_id: 70}] : [];
        if (path in ROUTES) return ROUTES[path];
        throw new Error('404');
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getCurrentUser.mockResolvedValue({personId: 'p-10'});
    PeriodService.getActiveBySchool.mockResolvedValue({name: '2026-II', startsOn: '2026-07-01', endsOn: '2026-12-15'});
    PeriodService.getAll.mockResolvedValue([]);
    JustificationService.getAll.mockResolvedValue([{attendanceRecordId: 1, reviewStatus: 'Approved', reason: 'Cita', reviewedAt: '2026-10-28T10:00:00Z'}]);
});

async function load(role, actors) {
    getCurrentUserRole.mockResolvedValue(role);
    ActorService.getByPerson.mockResolvedValue(actors);
    const hook = await renderHook(useAttendanceViewModel);
    await flush();
    await flush();
    return hook.result;
}

test('a learner sees its own records fully enriched, with the active period and the justification', async () => {
    backend((p) => (p?.academicActorId === 10 ? [RECORD] : []));

    const vm = await load('Aprendiz', [{academicActorId: 10, schoolId: 2}]);

    expect(vm().isStaff).toBe(false);
    expect(vm().activeData).toHaveLength(1);
    expect(vm().activeData[0]).toMatchObject({
        id: 1, nombre: 'Ana Pérez', fecha: '2026-10-27', estado: 'tarde', materia: 'Bases de datos', codigo_curso: 'BD1',
        hora_inicio: '07:00', hora_fin: '09:00', salon: 'Sala 2', periodo: '2026-II', docente: 'Iván Ruiz',
        justificacion: {estado: 'Approved', texto: 'Cita', revisado_en: '2026-10-28'},
    });
    expect(vm().isDark).toBe(true);
});

test('an instructor walks its blocks and sessions with camelCase filters', async () => {
    backend((p) => (p?.classSessionId === 70 ? [RECORD, {...RECORD, attendance_record_id: 2, attendance_status: 'Absent', captured_at: null}] : []));

    const vm = await load('Instructor', [{academicActorId: 20, schoolId: 2}]);

    expect(vm().isStaff).toBe(true);
    expect(vm().activeData.map((r) => r.estado).sort()).toEqual(['ausente', 'tarde']);
    const absent = vm().activeData.find((r) => r.id === 2);
    expect(absent).toMatchObject({hora: '—', fecha: '2026-10-27'});
});

test('an admin lists every record; a record whose links fail still shows with placeholders', async () => {
    backend(() => [{attendance_record_id: 9, attendance_status: 'Present', captured_at: '2026-10-27T13:00:00Z'}]);

    const vm = await load('Administrador', []);

    expect(vm().isAdmin).toBe(true);
    expect(vm().activeData[0]).toMatchObject({id: 9, estado: 'presente', materia: '—', salon: '—', docente: '—', periodo: '—'});
    expect(vm().activeData[0].nombre).toContain('attendance.unknownPerson');
});

test('search and status filters narrow the list for staff', async () => {
    backend(() => [RECORD, {...RECORD, attendance_record_id: 2, academic_actor_id: 99, attendance_status: 'Present'}]);
    const vm = await load('Administrador', []);

    act(() => vm().setStatusFilter('tarde'));
    expect(vm().activeData.map((r) => r.id)).toEqual([1]);
    act(() => vm().setStatusFilter(''));
    act(() => vm().setSearchText('ana'));
    expect(vm().activeData.map((r) => r.id)).toEqual([1]);
});

test('a failing record list shows the error and retry loads again', async () => {
    backendGet.mockRejectedValue(new Error('503'));
    const vm = await load('Administrador', []);
    expect(vm().error).toBe('attendance.loadError');

    backend(() => [RECORD]);
    await act(async () => {
        await vm().retry();
    });
    expect(vm().error).toBeNull();
    expect(vm().activeData).toHaveLength(1);
});

test('the date picker opens the platform picker and sets the chosen bound', async () => {
    backend(() => []);
    const vm = await load('Administrador', []);

    Platform.OS = 'android';
    act(() => vm().handleOpenPicker('to'));
    expect(vm().showPicker).toBe(true);
    act(() => vm().handleAndroidChange({type: 'set'}, new Date(2026, 9, 31)));
    expect(vm().showPicker).toBe(false);
    expect(formatDateKey(vm().toDate)).toBe('2026-10-31');

    Platform.OS = 'ios';
    act(() => vm().handleOpenPicker('from'));
    expect(vm().showIOSModal).toBe(true);

    act(() => vm().openDetail({id: 1}));
    expect(vm().showDetailModal).toBe(true);
    act(() => vm().closeDetail());
    expect(vm().detailItem).toBeNull();
});

test('display helpers', () => {
    const colors = {statusTextPresente: 'p', statusPresente: 'pb', statusTextTarde: 't', statusTarde: 'tb', info: '#000000', danger: '#ff0000', success: 'g', warning: 'w'};
    expect(statusTokens(colors, 'presente').label).toBe('attendance.present');
    expect(statusTokens(colors, 'justificado').bg).toBe('#0000001F');
    expect(statusTokens(colors, 'otro').label).toBe('attendance.absent');
    expect(approvalTokens(colors, 'Approved').color).toBe('g');
    expect(approvalTokens(colors, 'Rejected').color).toBe('#ff0000');
    expect(approvalTokens(colors, 'Pending').label).toBe('attendance.pending');
    expect(getSubjectLabel('Matemáticas', (k) => k)).toBe('subjects.math');
    expect(getSubjectLabel('Química', (k) => k)).toBe('Química');
    expect(formatDateKey(null)).toBe('');
    expect([resolveLocale('en'), resolveLocale('pt'), resolveLocale('fr'), resolveLocale('xx')]).toEqual(['en-US', 'pt-BR', 'fr-FR', 'es-ES']);
    expect(getDayLabel(0)).toBe('—');
    expect(getDayLabel(1, 'es-ES')).toMatch(/lunes/i);
    expect(formatDateDisplay(null, (k) => k)).toBe('attendance.filterByDate');
    expect(formatDateDisplay(new Date(2026, 9, 31), (k) => k)).toMatch(/2026/);
});
