import {Share} from 'react-native';
import {useAttendanceReportViewModel} from '../useAttendanceReportViewModel';
import {request} from '../../api/apiClient';
import {backendGet} from '../../api/backend';
import {getCurrentUserRole} from '../../services/UserService';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k)};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
const mockAlerts = {alertConfig: {}, hideAlert: jest.fn(), showSuccess: jest.fn(), showError: jest.fn(), showConfirm: jest.fn()};
jest.mock('../../view/components/common/useCustomAlert', () => ({useCustomAlert: () => mockAlerts}));
jest.mock('../../api/apiClient', () => ({request: jest.fn(), GET: 'GET'}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));
jest.mock('../../services/UserService', () => ({getCurrentUserRole: jest.fn()}));

const ACTORS = [
    {academic_actor_id: 1, actor_type_id: 1, actor_code: 'A-1', person_id: 'p-1'},
    {academic_actor_id: 2, actor_type_id: 1, actor_code: 'A-2', person_id: 'p-2'},
    {academic_actor_id: 3, actor_type_id: 2, actor_code: 'I-3', person_id: 'p-3'},
];
const SUMMARY = {1: {absent: 5, late: 0}, 2: {absent: 1, late: 8}, 3: {absent: 4, late: 0}};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    backendGet.mockImplementation(async (_b, path) => {
        if (path === 'api/v1/academic-actors') return ACTORS;
        if (path === 'api/v1/persons/p-1') return [{name: 'Ana', last_name: 'Pérez'}];
        if (path === 'api/v1/persons/p-2') return [{name: 'Luis', last_name: 'Gil'}];
        throw new Error('404');
    });
    request.mockImplementation(async ({url, responseType}) => {
        if (responseType === 'text') return 'scope,id,present\nactor,1,0';
        if (url.includes('/summary')) return SUMMARY;
        throw new Error('unexpected');
    });
    jest.spyOn(Share, 'share').mockResolvedValue({action: Share.sharedAction});
});

async function load(role) {
    getCurrentUserRole.mockResolvedValue(role);
    const hook = await renderHook(useAttendanceReportViewModel);
    await flush();
    await flush();
    return hook.result;
}

test('an admin sees learners and instructors over the absence limit, with names only for the flagged ones', async () => {
    const vm = await load('Administrador');

    expect(vm().canSeeTeachers).toBe(true);
    // Aprendiz 1: 5 ausencias (> 3) → crítico; aprendiz 2: 1 ausencia → no aparece en "ausencias".
    expect(vm().filteredData.map((p) => [p.id, p.name])).toEqual([[1, 'Ana Pérez']]);
    expect(vm().summary).toEqual({critical: 1, warning: 0, ok: 1});
    const summaryCall = request.mock.calls.find(([c]) => c.url.includes('/summary'))[0];
    expect(summaryCall.url).toContain('academicActorIds=1&academicActorIds=2&academicActorIds=3');

    act(() => vm().handleRoleChange('teacher'));
    // El instructor 3 está marcado pero su persona no carga: queda con el nombre por defecto.
    expect(vm().filteredData.map((p) => p.id)).toEqual([3]);
    expect(vm().filteredData[0].name).toContain('attendance.unknownPerson');
});

test('lateness and level filters, and search, narrow the list', async () => {
    const vm = await load('Administrador');

    act(() => vm().setActiveType('lateness'));
    expect(vm().filteredData.map((p) => p.id)).toEqual([2]);
    act(() => vm().setActiveFilter('warning'));
    expect(vm().filteredData.map((p) => p.id)).toEqual([2]);
    act(() => vm().setActiveFilter('critical'));
    expect(vm().filteredData).toEqual([]);

    act(() => vm().setActiveFilter('all'));
    act(() => vm().setSearchText('zzz'));
    expect(vm().filteredData).toEqual([]);
    act(() => vm().setSearchText('luis'));
    expect(vm().filteredData.map((p) => p.id)).toEqual([2]);
});

test('an instructor only sees the learners the summary returned for their cohorts', async () => {
    request.mockImplementation(async ({url}) => (url.includes('/summary') ? {1: {absent: 9, late: 0}} : null));

    const vm = await load('Instructor');

    expect(vm().canSeeTeachers).toBe(false);
    const summaryCall = request.mock.calls.find(([c]) => c.url.includes('/summary'))[0];
    expect(summaryCall.url).not.toContain('academicActorIds=3'); // los instructores ni se piden
    expect(vm().filteredData.map((p) => p.id)).toEqual([1]);
});

test('a failing actor list shows the error', async () => {
    backendGet.mockRejectedValue(new Error('503'));

    const vm = await load('Administrador');

    expect(vm().error).toBe('attendance.loadError');
    expect(vm().isLoading).toBe(false);
});

test('an individual report is shared with the official CSV and confirmed', async () => {
    const vm = await load('Administrador');
    act(() => vm().handleGenerateIndividual(vm().filteredData[0]));
    expect(vm().modalVisible).toBe(true);

    await act(async () => {
        await vm().handleConfirmReport();
    });

    const {message} = Share.share.mock.calls[0][0];
    expect(message).toContain('Ana Pérez (A-1)');
    expect(message).toContain('scope,id,present');
    expect(request.mock.calls.find(([c]) => c.responseType === 'text')[0].url).toContain('attendance-reports?academicActorIds=1&format=csv');
    expect(mockAlerts.showSuccess).toHaveBeenCalled();
    expect(vm().modalVisible).toBe(false);
});

test('without the CSV the report is still shared, and a share failure is reported', async () => {
    request.mockImplementation(async ({url, responseType}) => {
        if (responseType === 'text') throw new Error('500');
        return url.includes('/summary') ? SUMMARY : null;
    });
    const vm = await load('Administrador');
    act(() => vm().handleGenerateIndividual(vm().filteredData[0]));

    await act(async () => {
        await vm().handleConfirmReport();
    });
    expect(Share.share.mock.calls[0][0].message).not.toContain('scope,id');

    Share.share.mockRejectedValueOnce(new Error('share failed'));
    await act(async () => {
        await vm().handleConfirmReport();
    });
    expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', 'share failed');
});

test('the general report asks for confirmation and does nothing when the list is empty', async () => {
    const vm = await load('Administrador');

    act(() => vm().handleGenerateAll());
    expect(mockAlerts.showConfirm).toHaveBeenCalledTimes(1);
    await act(async () => {
        await mockAlerts.showConfirm.mock.calls[0][2]();
    });
    expect(Share.share).toHaveBeenCalledTimes(1);

    act(() => vm().setSearchText('nadie'));
    act(() => vm().handleGenerateAll());
    expect(mockAlerts.showConfirm).toHaveBeenCalledTimes(1);
});
