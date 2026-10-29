// Radicar, consultar y administrar justificaciones desde el móvil (HU-JUS-001, ERF 6.x).
import * as DocumentPicker from 'expo-document-picker';
import {useAddJustificationViewModel} from '../useAddJustifyViewModel';
import {useValidJustificationsViewModel} from '../useConsultJustifyViewModel';
import {useMenuJustifyViewModel} from '../useMenuJustifyViewModel';
import {useJustificationsViewModel} from '../useValidAllJustificationsViewModel';
import {useAddValidJustificationViewModel} from '../useAddValidJustificationViewModel';
import {useUserDetailViewModel, MIN_ATTENDANCE} from '../useUserDetailViewModel';
import {getCurrentUser, getCurrentUserRole} from '../../services/UserService';
import {ActorService} from '../../services/ActorService';
import {JustificationService, getJustificationTypeMap, getAttendanceRecordCached} from '../../services/JustificationService';
import {PersonService} from '../../services/PersonService';
import {FaceAuthService} from '../../services/FaceAuthService';
import {AttendanceService} from '../../services/AttendanceService';
import {EnrollmentService} from '../../services/EnrollmentService';
import {CohortService} from '../../services/CohortService';
import {ProgramService} from '../../services/ProgramService';
import {backendGet} from '../../api/backend';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: {language: 'es'}};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('@react-navigation/native', () => {
    const {useEffect} = jest.requireActual('react');
    const mockNavigation = {goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {})};
    const mockRoute = {params: {}};
    return {
        useFocusEffect: (cb) => useEffect(cb, [cb]),
        useNavigation: () => mockNavigation,
        useRoute: () => mockRoute,
        __navigation: mockNavigation,
        __route: mockRoute,
    };
});
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {colors: {success: 'g', danger: 'r', warning: 'y'}, loadThemeForRole: jest.fn()};
    return {useTheme: () => theme};
});
jest.mock('../../view/components/common/languageByRole', () => ({saveLanguageForRole: jest.fn()}));
jest.mock('../../utils/useLanguageRefresh', () => ({useLanguageRefresh: () => 0}));
const mockAlerts = {alertConfig: {}, hideAlert: jest.fn(), showSuccess: jest.fn(), showError: jest.fn(), showWarning: jest.fn(), showConfirm: jest.fn()};
jest.mock('../../view/components/common/useCustomAlert', () => ({useCustomAlert: () => mockAlerts}));
jest.mock('expo-document-picker', () => ({getDocumentAsync: jest.fn()}));
jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn()}));
jest.mock('../../services/ActorService', () => ({ActorService: {getByPerson: jest.fn()}}));
jest.mock('../../services/JustificationService', () => ({
    JustificationService: {
        getAll: jest.fn(), getByActor: jest.fn(), getPending: jest.fn(), create: jest.fn(), uploadDocument: jest.fn(),
        getTypes: jest.fn(), deleteType: jest.fn(), createType: jest.fn(), updateType: jest.fn(),
    },
    getJustificationTypeMap: jest.fn(),
    getAttendanceRecordCached: jest.fn(),
    mapConcurrent: jest.requireActual('../../services/JustificationService').mapConcurrent,
}));
jest.mock('../../services/PersonService', () => ({PersonService: {getById: jest.fn()}}));
jest.mock('../../services/FaceAuthService', () => ({FaceAuthService: {summary: jest.fn()}}));
jest.mock('../../services/AttendanceService', () => ({AttendanceService: {getSummary: jest.fn()}}));
jest.mock('../../services/EnrollmentService', () => ({EnrollmentService: {getActiveByActor: jest.fn()}}));
jest.mock('../../services/CohortService', () => ({CohortService: {getById: jest.fn()}}));
jest.mock('../../services/ProgramService', () => ({ProgramService: {getById: jest.fn()}}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));

const {__navigation: navigation, __route: route} = jest.requireMock('@react-navigation/native');

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    route.params = {};
    getCurrentUser.mockResolvedValue({userId: 'u-1', personId: 'p-1'});
    ActorService.getByPerson.mockResolvedValue([{academicActorId: 10}]);
});

describe('radicar una justificación (aprendiz)', () => {
    const RECORDS = [
        {attendance_record_id: 1, attendance_status: 'Absent', class_session_id: 70},
        {attendance_record_id: 2, attendance_status: 'Late', class_session_id: 71},
        {attendance_record_id: 3, attendance_status: 'Present', class_session_id: 72},
        {attendance_record_id: 4, attendance_status: 'Absent', class_session_id: 73},
    ];

    beforeEach(() => {
        backendGet.mockImplementation(async (_b, path) => {
            if (path === 'api/v1/attendance-records') return RECORDS;
            if (path === 'api/v1/class-sessions/70') return [{session_date: '2026-10-20'}];
            if (path === 'api/v1/class-sessions/71') return [{session_date: '2026-10-25'}];
            if (path === 'api/v1/justification-types') return [{justification_type_id: 5, name: 'Inasistencia'}, {justification_type_id: 6, name: 'Retardo'}];
            throw new Error('404');
        });
        // El registro 4 ya tiene justificación.
        JustificationService.getAll.mockResolvedValue([{attendanceRecordId: 4}]);
        JustificationService.create.mockResolvedValue({justificationId: 30});
        JustificationService.uploadDocument.mockResolvedValue({});
    });

    async function form() {
        const hook = await renderHook(useAddJustificationViewModel);
        await flush();
        return hook.result;
    }

    test('only own absences and lates without a justification are offered, newest session first', async () => {
        const vm = await form();

        expect(vm().records.map((r) => [r.attendance_record_id, r.session_date])).toEqual([[2, '2026-10-25'], [1, '2026-10-20']]);
        expect(vm().recordsLoading).toBe(false);
    });

    test('the form asks for the record, the reason and the attachment before sending', async () => {
        const vm = await form();

        await act(async () => vm().handleSubmit());
        act(() => vm().setSelectedRecordId(2));
        await act(async () => vm().handleSubmit());
        act(() => vm().setDescription('Cita médica'));
        await act(async () => vm().handleSubmit());

        expect(mockAlerts.showWarning.mock.calls.map((c) => c[1])).toEqual(['justify.selectRecordError', 'justify.enterReason', 'justify.missingAttachmentError']);
        expect(JustificationService.create).not.toHaveBeenCalled();
    });

    test('an invalid or too large file is refused at pick time', async () => {
        const vm = await form();
        DocumentPicker.getDocumentAsync
            .mockResolvedValueOnce({canceled: true})
            .mockResolvedValueOnce({canceled: false, assets: [{name: 'x.exe', mimeType: 'application/x-msdownload', size: 10}]})
            .mockResolvedValueOnce({canceled: false, assets: [{name: 'x.pdf', mimeType: 'application/pdf', size: 6 * 1024 * 1024}]});

        await act(async () => vm().pickFile());
        await act(async () => vm().pickFile());
        await act(async () => vm().pickFile());

        expect(mockAlerts.showWarning.mock.calls.map((c) => c[1])).toEqual(['justify.invalidFileFormat', 'justify.fileTooLarge']);
        expect(vm().selectedFile).toBeNull();
    });

    test('a late is filed with the late type and its support is uploaded to the new justification', async () => {
        const vm = await form();
        DocumentPicker.getDocumentAsync.mockResolvedValue({canceled: false, assets: [{uri: 'file:///c.pdf', name: 'c.pdf', mimeType: 'application/pdf', size: 1000}]});
        await act(async () => vm().pickFile());
        act(() => {
            vm().setSelectedRecordId(2);
            vm().setDescription('  Trancón  ');
        });

        await act(async () => vm().handleSubmit());

        expect(JustificationService.create).toHaveBeenCalledWith({attendanceRecordId: 2, justificationTypeId: 6, reason: 'Trancón'});
        expect(JustificationService.uploadDocument).toHaveBeenCalledWith(30, expect.objectContaining({name: 'c.pdf'}));
        expect(mockAlerts.showSuccess).toHaveBeenCalledWith('common.success', 'justify.successMessage', expect.any(Function));
        expect(vm().isLoading).toBe(false);
    });

    test('a failed upload is reported even though the justification was created', async () => {
        JustificationService.uploadDocument.mockRejectedValue(new Error('413'));
        const vm = await form();
        DocumentPicker.getDocumentAsync.mockResolvedValue({canceled: false, assets: [{name: 'c.pdf', mimeType: 'application/pdf', size: 1000}]});
        await act(async () => vm().pickFile());
        act(() => {
            vm().setSelectedRecordId(1);
            vm().setDescription('Enfermedad');
        });

        await act(async () => vm().handleSubmit());

        expect(JustificationService.create.mock.calls[0][0].justificationTypeId).toBe(5);
        expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', 'justify.uploadError', expect.any(Function));
        expect(mockAlerts.showSuccess).not.toHaveBeenCalled();
    });

    test('a failure loading the records is shown', async () => {
        backendGet.mockRejectedValue(new Error('503'));

        await form();

        expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', 'justify.loadRecordsError');
    });
});

describe('consultar mis justificaciones', () => {
    beforeEach(() => {
        getJustificationTypeMap.mockResolvedValue({1: {name: 'Médica'}});
        getAttendanceRecordCached.mockImplementation(async (id) => ({attendance_status: id === 2 ? 'Late' : 'Absent'}));
        JustificationService.getByActor.mockResolvedValue([
            {justificationId: 11, justificationTypeId: 1, attendanceRecordId: 1, reason: 'Gripa', submittedAt: '2026-10-20T10:00:00Z', reviewStatus: 'Approved', reviewedAt: '2026-10-21T08:00:00.000Z', resolutionNotes: 'OK'},
            {justificationId: 12, justificationTypeId: 9, attendanceRecordId: 2, reason: 'Bus', submittedAt: '2026-10-22T07:40:00Z', reviewStatus: 'Rejected'},
        ]);
    });

    test('absences and lates are split, with type, state and reviewer notes', async () => {
        const hook = await renderHook(useValidJustificationsViewModel);
        await flush();
        const vm = hook.result;

        expect(vm().inasistenciasData).toEqual([expect.objectContaining({id: 11, motivo: 'Médica', estado: 'approved', reviewerNotes: 'OK', fecha: '2026-10-20'})]);
        expect(vm().retardosData[0]).toMatchObject({id: 12, motivo: 'Bus', estado: 'rejected'});
        expect(vm().retardosData[0].hora).toBeTruthy();
        expect(vm().getEstadoColor('approved')).toBe('g');
        expect(vm().getEstadoColor('rejected')).toBe('r');
        expect(vm().getEstadoLabel('pending')).toBe('consultJustify.statusPending');

        act(() => vm().setActiveSection('retardos'));
        expect(vm().currentData.map((j) => j.id)).toEqual([12]);
    });

    test('opening from the result alert selects that justification', async () => {
        route.params = {reviewedAt: '2026-10-21T08:00:00.000Z'};

        const hook = await renderHook(useValidJustificationsViewModel);
        await flush();

        expect(hook.result().selectedItem?.id).toBe(11);
        expect(hook.result().activeSection).toBe('inasistencias');
    });

    test('a load failure is shown', async () => {
        JustificationService.getByActor.mockRejectedValue(new Error('503'));

        const hook = await renderHook(useValidJustificationsViewModel);
        await flush();

        expect(hook.result().error).toBe('justifications.loadError');
    });
});

describe('menú de justificaciones', () => {
    test('shows the pending count and routes each role to its form', async () => {
        getCurrentUserRole.mockResolvedValue('Aprendiz');
        JustificationService.getPending.mockResolvedValue([{}, {}]);

        const hook = await renderHook(useMenuJustifyViewModel);
        await flush();

        expect(hook.result().pendingCount).toBe(2);
        act(() => hook.result().handleAddOrEditJustify());
        expect(navigation.navigate).toHaveBeenLastCalledWith('AddJustification');
        act(() => hook.result().handleValidJustifications());
        expect(navigation.navigate).toHaveBeenLastCalledWith('ValidJustifications');
    });

    test('without a verified role nothing is loaded or opened', async () => {
        getCurrentUserRole.mockResolvedValue(null);

        const hook = await renderHook(useMenuJustifyViewModel);
        await flush();
        act(() => hook.result().handleAddOrEditJustify());

        expect(JustificationService.getPending).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    test('an instructor goes to the validation form', async () => {
        getCurrentUserRole.mockResolvedValue('Instructor');
        JustificationService.getPending.mockResolvedValue([]);

        const hook = await renderHook(useMenuJustifyViewModel);
        await flush();
        act(() => hook.result().handleAddOrEditJustify());

        expect(navigation.navigate).toHaveBeenLastCalledWith('AddValidJustification');
    });
});

describe('catálogo de tipos de justificación (administrador)', () => {
    beforeEach(() => {
        getCurrentUserRole.mockResolvedValue('Administrador');
        JustificationService.getTypes.mockResolvedValue([
            {justification_type_id: 1, name: 'Médica', requires_attachment: true},
            {justification_type_id: 2, name: 'Calamidad familiar', description: 'Duelo'},
            {justification_type_id: 3, name: 'Otra'},
        ]);
    });

    test('types are grouped by category', async () => {
        const hook = await renderHook(useJustificationsViewModel);
        await flush();

        expect(hook.result().categories).toEqual(['health', 'family', 'general']);
        expect(hook.result().getJustificationsByCategory('health')[0]).toMatchObject({id: '1', requiresDocument: true});
        expect(navigation.addListener).toHaveBeenCalledWith('focus', expect.any(Function));
    });

    test('deleting asks for confirmation and a referenced type explains the error', async () => {
        const hook = await renderHook(useJustificationsViewModel);
        await flush();
        JustificationService.deleteType.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('El tipo está en uso'));

        act(() => hook.result().deleteType(hook.result().justifications[0]));
        await act(async () => mockAlerts.showConfirm.mock.calls[0][2]());
        expect(hook.result().justifications.map((j) => j.id)).toEqual(['2', '3']);

        act(() => hook.result().deleteType(hook.result().justifications[0]));
        await act(async () => mockAlerts.showConfirm.mock.calls[1][2]());
        expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', 'El tipo está en uso');
        expect(hook.result().justifications).toHaveLength(2);

        act(() => hook.result().editType({id: '2'}));
        expect(navigation.navigate).toHaveBeenCalledWith('AddValidJustification', {typeToEdit: {id: '2'}});
    });

    test('a catalog failure is shown', async () => {
        JustificationService.getTypes.mockRejectedValue(new Error('403'));

        const hook = await renderHook(useJustificationsViewModel);
        await flush();

        expect(mockAlerts.showError).toHaveBeenCalledWith('common.error', '403');
        expect(hook.result().loading).toBe(false);
    });
});

describe('formulario de tipo de justificación', () => {
    test('a new type needs every field and is created with the trimmed values', async () => {
        JustificationService.createType.mockResolvedValue({});
        const hook = await renderHook(useAddValidJustificationViewModel);

        await act(async () => hook.result().handleSave());
        expect(hook.result().alertData.message).toBe('admin.completeAllFields');

        act(() => {
            hook.result().setType(' Médica ');
            hook.result().setDescription(' Incapacidad ');
            hook.result().setCategory('admin.categoryHealth');
            hook.result().setRequiresDocument(false);
        });
        await act(async () => hook.result().handleSave());

        expect(JustificationService.createType).toHaveBeenCalledWith({name: 'Médica', description: 'Incapacidad', requiresAttachment: false});
        expect(hook.result().alertData).toMatchObject({message: 'admin.justificationCreated', type: 'success'});
        expect(hook.result().selectedCategory.id).toBe('salud');
    });

    test('editing prefills the form and updates the type', async () => {
        route.params = {typeToEdit: {id: '2', type: 'Calamidad', description: 'Duelo', requiresDocument: true}};
        JustificationService.updateType.mockRejectedValue(new Error('409'));

        const hook = await renderHook(useAddValidJustificationViewModel);
        await flush();
        expect(hook.result()).toMatchObject({type: 'Calamidad', description: 'Duelo', isEditing: true, category: 'admin.categoryOther'});

        await act(async () => hook.result().handleSave());

        expect(JustificationService.updateType).toHaveBeenCalledWith('2', {name: 'Calamidad', description: 'Duelo', requiresAttachment: true});
        expect(hook.result().alertData).toMatchObject({message: '409', type: 'error'});
        expect(hook.result().isSaving).toBe(false);
    });
});

describe('detalle de usuario', () => {
    beforeEach(() => {
        route.params = {user: {personId: 'p-1', nombre: 'Ana', username: 'ana', status: true, roleNames: ['Aprendiz']}};
        ActorService.getByPerson.mockResolvedValue([{academicActorId: 10}, {academicActorId: 11}]);
        PersonService.getById.mockResolvedValue({fullName: 'Ana Pérez', email: 'ana@x.co', phone: '300', documentNumber: '123'});
        FaceAuthService.summary.mockResolvedValue({has_face: true, has_fingerprint: false});
        AttendanceService.getSummary.mockResolvedValue(new Map([
            [10, {present: 6, late: 1, absent: 2, justified: 1, total: 10}],
            [11, {present: 0, late: 0, absent: 0, justified: 0, total: 0}],
        ]));
        EnrollmentService.getActiveByActor.mockImplementation(async (id) => (id === 11 ? [{cohortId: 7}] : []));
        CohortService.getById.mockResolvedValue({code: 'F-1', programId: 3});
        ProgramService.getById.mockResolvedValue({name: 'ADSO'});
    });

    test('aggregates the person, biometrics, attendance of all its actors and its program', async () => {
        const hook = await renderHook(useUserDetailViewModel);
        await flush();
        const vm = hook.result;

        expect(vm()).toMatchObject({name: 'Ana Pérez', email: 'ana@x.co', documentNumber: '123', program: 'ADSO', cohort: 'F-1', active: true, loading: false});
        expect(vm().biometrics).toEqual({hasFace: true, hasFingerprint: false});
        expect(vm().attendance).toMatchObject({present: 6, total: 10, rate: 80});
        expect(vm().attendance.rate).toBeGreaterThanOrEqual(MIN_ATTENDANCE);

        act(() => vm().openFaceRegistration());
        expect(navigation.navigate).toHaveBeenCalledWith('RegisterFace', {personId: 'p-1', personName: 'Ana Pérez', mode: 'update'});
    });

    test('one failing block does not empty the rest of the detail', async () => {
        PersonService.getById.mockRejectedValue(new Error('503'));
        FaceAuthService.summary.mockRejectedValue(new Error('503'));

        const hook = await renderHook(useUserDetailViewModel);
        await flush();

        expect(hook.result()).toMatchObject({name: 'Ana', program: 'ADSO', biometrics: null});
    });

    test('without a person there is nothing to load', async () => {
        route.params = {user: {username: 'sinpersona'}};

        const hook = await renderHook(useUserDetailViewModel);
        await flush();

        expect(hook.result()).toMatchObject({loading: false, canRegisterFace: false, name: 'sinpersona'});
        expect(ActorService.getByPerson).not.toHaveBeenCalled();
    });
});
