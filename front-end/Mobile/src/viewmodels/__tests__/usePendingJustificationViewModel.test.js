import {Alert} from 'react-native';
import {usePendingJustificationViewModel, getInitials, getAvatarColor, getFileIcon} from '../usePendingJustificationViewModel';
import {getCurrentUser, getCurrentUserRole} from '../../services/UserService';
import {ActorService} from '../../services/ActorService';
import {JustificationService, getJustificationTypeMap, getAcademicActorMap, getAttendanceRecordCached, getPersonCached} from '../../services/JustificationService';
import {openSupportingDocument} from '../../services/supportingDocumentViewer';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('react-i18next', () => {
    const translation = {t: (k) => k, i18n: {language: 'es'}};
    return {useTranslation: () => translation, initReactI18next: {type: '3rdParty', init: () => {}}};
});
jest.mock('../../view/components/common/ThemeContext', () => {
    const theme = {colors: {}};
    return {useTheme: () => theme};
});
jest.mock('../../services/UserService', () => ({getCurrentUser: jest.fn(), getCurrentUserRole: jest.fn()}));
jest.mock('../../services/ActorService', () => ({ActorService: {getByPerson: jest.fn()}}));
jest.mock('../../services/supportingDocumentViewer', () => ({
    openSupportingDocument: jest.fn(),
    DOCUMENT_ERRORS: {NO_VIEWER: 'NO_VIEWER'},
}));
jest.mock('../../services/JustificationService', () => ({
    JustificationService: {getByActor: jest.fn(), getByStatus: jest.fn(), getAll: jest.fn(), getDocuments: jest.fn(), approve: jest.fn(), reject: jest.fn()},
    getJustificationTypeMap: jest.fn(),
    getAcademicActorMap: jest.fn(),
    getAttendanceRecordCached: jest.fn(),
    getPersonCached: jest.fn(),
    mapConcurrent: jest.requireActual('../../services/JustificationService').mapConcurrent,
}));

const justification = (id, status, typeId = 1) => ({justificationId: id, justificationTypeId: typeId, attendanceRecordId: id * 10, reason: `Motivo ${id}`, submittedAt: '2026-10-27T10:00:00Z', reviewStatus: status});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    getCurrentUser.mockResolvedValue({userId: 'u-rev', personId: 'p-1'});
    getJustificationTypeMap.mockResolvedValue({1: {name: 'Médica'}, 2: {name: 'Retardo'}});
    // actor 100: aprendiz (tipo 1); actor 200: instructor (tipo 2)
    getAcademicActorMap.mockResolvedValue({100: {person_id: 'p-a', actor_type_id: 1, actor_code: 'A-1'}, 200: {person_id: 'p-i', actor_type_id: 2}});
    getAttendanceRecordCached.mockImplementation(async (id) => ({academic_actor_id: id === 30 ? 200 : 100}));
    getPersonCached.mockImplementation(async (id) => (id === 'p-a' ? {name: 'Ana', last_name: 'Pérez'} : {name: 'Iván', last_name: 'Ruiz'}));
    JustificationService.getDocuments.mockResolvedValue([]);
});

async function load(role) {
    getCurrentUserRole.mockResolvedValue(role);
    const hook = await renderHook(usePendingJustificationViewModel);
    await flush();
    return hook.result;
}

test('an instructor sees pending and approved requests of learners only, enriched with the person and type', async () => {
    JustificationService.getByStatus.mockImplementation(async (s) => (s === 'Pending' ? [justification(1, 'Pending', 2), justification(3, 'Pending')] : [justification(2, 'Approved')]));
    JustificationService.getDocuments.mockImplementation(async (id) => (id === 1 ? [{supporting_document_id: 9, file_name: 'cita.pdf', mime_type: 'application/pdf', size_bytes: 2048}] : []));

    const vm = await load('Instructor');

    expect(vm().userRole).toBe('teacher');
    // La 3 es de un instructor: no aparece en la lista del instructor.
    expect(vm().filtered.map((j) => j.id).sort()).toEqual(['1', '2']);
    const first = vm().filtered.find((j) => j.id === '1');
    expect(first).toMatchObject({userName: 'Ana Pérez', userCode: 'A-1', type: 'retardo', status: 'pending', date: '2026-10-27'});
    expect(first.attachment).toEqual({id: 9, name: 'cita.pdf', mime: 'application/pdf', size: '2 KB'});
    expect(vm().counts).toEqual({all: 3, pending: 2, approved: 1});

    act(() => vm().setActiveFilter('approved'));
    expect(vm().filtered.map((j) => j.id)).toEqual(['2']);
});

test('a learner only loads the requests of their own actors', async () => {
    ActorService.getByPerson.mockResolvedValue([{academicActorId: 100}]);
    JustificationService.getByActor.mockResolvedValue([justification(1, 'Rejected')]);

    const vm = await load('Aprendiz');

    expect(JustificationService.getByActor).toHaveBeenCalledWith(100);
    expect(vm().filtered[0].status).toBe('rejected');
    expect(vm().counts).toEqual({all: 1});
});

test('a learner without an academic actor sees nothing', async () => {
    ActorService.getByPerson.mockResolvedValue([]);

    const vm = await load('Aprendiz');

    expect(vm().filtered).toEqual([]);
    expect(JustificationService.getByActor).not.toHaveBeenCalled();
});

test('an admin loads everything and filters by role', async () => {
    JustificationService.getAll.mockResolvedValue([justification(1, 'Pending'), justification(3, 'Pending')]);

    const vm = await load('Administrador');

    expect(vm().counts).toEqual({all: 2, student: 1, teacher: 1});
    act(() => vm().setActiveFilter('teacher'));
    expect(vm().filtered.map((j) => j.id)).toEqual(['3']);
});

test('an unknown role gets no access', async () => {
    const vm = await load('Invitado');

    expect(vm().userRole).toBeNull();
    expect(vm().filtered).toEqual([]);
    expect(JustificationService.getAll).not.toHaveBeenCalled();
});

test('no stored role is an error, not an empty list', async () => {
    const vm = await load(null);

    expect(vm().error).toBe('justifications.loadError');
    expect(vm().loading).toBe(false);
});

test('a backend failure shows the error', async () => {
    JustificationService.getAll.mockRejectedValue(new Error('503'));

    const vm = await load('Administrador');

    expect(vm().error).toBe('justifications.loadError');
    expect(vm().filtered).toEqual([]);
});

test('approving and rejecting send the reviewer and update the item', async () => {
    JustificationService.getAll.mockResolvedValue([justification(1, 'Pending'), justification(2, 'Pending')]);
    JustificationService.approve.mockResolvedValue({reviewStatus: 'Approved'});
    JustificationService.reject.mockResolvedValue({reviewStatus: 'Rejected'});
    const vm = await load('Administrador');

    await act(async () => {
        await vm().approveJustification('1');
        await vm().rejectJustification('2', 'Sin soporte');
    });

    expect(JustificationService.approve).toHaveBeenCalledWith('1', 'u-rev');
    expect(JustificationService.reject).toHaveBeenCalledWith('2', 'u-rev', 'Sin soporte');
    expect(vm().filtered.map((j) => j.status)).toEqual(['approved', 'rejected']);
});

test('a learner cannot review', async () => {
    ActorService.getByPerson.mockResolvedValue([]);
    const vm = await load('Aprendiz');

    await act(async () => {
        await vm().approveJustification('1');
    });

    expect(JustificationService.approve).not.toHaveBeenCalled();
});

test('an attachment that cannot be opened explains why', async () => {
    JustificationService.getAll.mockResolvedValue([]);
    openSupportingDocument.mockRejectedValueOnce(Object.assign(new Error('x'), {code: 'NO_VIEWER'})).mockRejectedValueOnce(new Error('404'));
    const vm = await load('Administrador');

    await act(async () => {
        await vm().openAttachment({id: 9});
        await vm().openAttachment({id: 9});
        await vm().openAttachment(null);
    });

    expect(Alert.alert.mock.calls.map((c) => c[1])).toEqual(['consultJustify.noDocumentViewer', 'consultJustify.documentUnavailable']);
});

test('display helpers', async () => {
    expect(getInitials('ana maría pérez')).toBe('AM');
    expect(getAvatarColor('Ana', ['a', 'b', 'c'])).toBe(['a', 'b', 'c']['Ana'.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 3]);
    expect([getFileIcon('application/pdf'), getFileIcon('image/png'), getFileIcon('application/msword'), getFileIcon('')]).toEqual(['📄', '🖼️', '📝', '📎']);

    JustificationService.getAll.mockResolvedValue([]);
    const vm = await load('Administrador');
    expect(vm().formatDate('')).toBe('—');
    expect(vm().formatDate('2026-10-27')).toMatch(/2026/);
    expect(vm().getTypeLabel('inasistencia')).toBe('justificationType.absence');
    expect(vm().getRoleLabel('student')).toBe('userRole.student');
});
