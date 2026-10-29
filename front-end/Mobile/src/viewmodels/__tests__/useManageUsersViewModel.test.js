import {useManageUsersViewModel} from '../useManageUsersViewModel';
import {backendGet} from '../../api/backend';
import {PersonService} from '../../services/PersonService';
import {UserService} from '../../services/UserService';
import {SchoolService} from '../../services/SchoolService';
import {changeRole, createAccount} from '../../services/userProvisioning';
import {renderHook, flush, act} from './support/renderHook';

jest.mock('../../utils/useLanguageRefresh', () => ({useLanguageRefresh: () => 0}));
jest.mock('../../api/backend', () => ({backendGet: jest.fn()}));
jest.mock('../../services/PersonService', () => ({PersonService: {update: jest.fn(), setStatus: jest.fn()}}));
jest.mock('../../services/UserService', () => ({UserService: {update: jest.fn(), setStatus: jest.fn()}}));
jest.mock('../../services/SchoolService', () => ({SchoolService: {getCurrentSchoolId: jest.fn()}}));
jest.mock('../../services/userProvisioning', () => ({changeRole: jest.fn(), createAccount: jest.fn()}));

const USERS = [
    {user_id: 'u-1', person_id: 'p-1', username: 'ana', status: true},
    {user_id: 'u-2', person_id: 'p-2', username: 'ivan', status: true},
    {user_id: 'u-3', person_id: null, username: 'sinrol', status: true},
];
const ROLES = {'u-1': [{role_id: 3, role_name: 'Aprendiz'}], 'u-2': [{role_id: 2, role_name: 'Instructor'}], 'u-3': []};
const PERSONS = {'p-1': {name: 'Ana', last_name: 'Pérez', document_number: '1', email: 'ana@x.co'}, 'p-2': {name: 'Iván', last_name: 'Ruiz', document_number: '2'}};

function backend(users = USERS) {
    backendGet.mockImplementation(async (_b, path, params) => {
        if (path === 'api/v1/users') return params.page === 1 ? users : [];
        const roles = /users\/(.+)\/roles/.exec(path);
        if (roles) return ROLES[roles[1]];
        const person = /persons\/(.+)$/.exec(path);
        if (person) {
            if (!PERSONS[person[1]]) throw new Error('404');
            return [PERSONS[person[1]]];
        }
        return [];
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    backend();
    PersonService.update.mockImplementation(async (_id, p) => ({fullName: `${p.name} ${p.lastName}`}));
    UserService.update.mockResolvedValue({});
    UserService.setStatus.mockResolvedValue(null);
    PersonService.setStatus.mockResolvedValue(null);
});

async function load(enabled = true) {
    const hook = await renderHook(useManageUsersViewModel, enabled);
    await flush();
    return hook.result;
}

test('accounts are split into learners and staff by their roles, with the person attached', async () => {
    const vm = await load();

    expect(vm().students.map((s) => s.nombre)).toEqual(['Ana Pérez']);
    expect(vm().teachers.map((t) => t.nombre)).toEqual(['Iván Ruiz']);
    expect(vm().students[0]).toMatchObject({userId: 'u-1', personId: 'p-1', documentNumber: '1', role: 'Aprendiz'});
    // La cuenta sin rol no cae en ninguna pestaña.
    expect([...vm().students, ...vm().teachers].map((u) => u.userId)).not.toContain('u-3');
});

test('every page of accounts is read', async () => {
    const page = Array.from({length: 100}, (_, i) => ({user_id: `x-${i}`, username: `x${i}`}));
    backendGet.mockImplementation(async (_b, path, params) => {
        if (path === 'api/v1/users') return params.page === 1 ? page : params.page === 2 ? [USERS[0]] : [];
        if (path.endsWith('/roles')) return path.includes('u-1') ? ROLES['u-1'] : [];
        return [PERSONS['p-1']];
    });

    const vm = await load();

    const pages = backendGet.mock.calls.filter(([, p]) => p === 'api/v1/users').map(([, , params]) => params.page);
    expect(pages).toEqual([1, 2]);
    expect(vm().students.map((s) => s.userId)).toEqual(['u-1']);
});

test('nothing is requested until the screen confirms the admin role', async () => {
    const vm = await load(false);

    expect(backendGet).not.toHaveBeenCalled();
    expect(vm().loading).toBe(false);
});

test('search matches by name and ignores blank queries', async () => {
    const vm = await load();

    expect(vm().searchStudents('  ')).toEqual([]);
    expect(vm().searchStudents('ana').map((s) => s.userId)).toEqual(['u-1']);
    expect(vm().searchTeachers('IVÁN').map((t) => t.userId)).toEqual(['u-2']);
});

test('editing saves person and account, and changes the role only when it changed', async () => {
    const vm = await load();
    const ana = vm().students[0];

    await act(async () => {
        await vm().updateStudent({...ana, name: ' Ana ', lastName: ' Gómez ', role: 'Aprendiz'});
    });
    expect(PersonService.update).toHaveBeenCalledWith('p-1', expect.objectContaining({name: 'Ana', lastName: 'Gómez', documentNumber: '1'}));
    expect(UserService.update).toHaveBeenCalledWith('u-1', expect.objectContaining({userId: 'u-1', personId: 'p-1'}));
    expect(changeRole).not.toHaveBeenCalled();

    await act(async () => {
        await vm().updateTeacher({...vm().teachers[0], role: 'Administrador'});
    });
    expect(changeRole).toHaveBeenCalledWith({userId: 'u-2', personId: 'p-2', currentRoles: ROLES['u-2'], roleName: 'Administrador'});
});

test('deactivating toggles the status of account and person, and a person failure does not undo it', async () => {
    PersonService.setStatus.mockRejectedValue(new Error('404'));
    const vm = await load();

    await act(async () => {
        await vm().deleteStudent('u-1');
    });

    expect(UserService.setStatus).toHaveBeenCalledWith('u-1', false);
    expect(vm().students[0].status).toBe(false);

    await act(async () => {
        await vm().deleteTeacher('u-2');
        await vm().deleteTeacher('no-existe');
    });
    expect(UserService.setStatus).toHaveBeenCalledTimes(2);
});

test('creating an account sends the trimmed form with the current school and reloads', async () => {
    SchoolService.getCurrentSchoolId.mockResolvedValue(4);
    const vm = await load();
    backendGet.mockClear();

    await act(async () => {
        await vm().createUser({
            name: ' Eva ', lastName: ' Ríos ', documentNumber: ' 77 ', email: ' ', telefono: '300 ',
            username: ' eva ', password: 'Secret-123', role: 'Aprendiz', privacyAccepted: true,
        });
    });

    expect(createAccount).toHaveBeenCalledWith({
        name: 'Eva', lastName: 'Ríos', documentNumber: '77', email: null, phone: '300', username: 'eva',
        password: 'Secret-123', roleName: 'Aprendiz', schoolId: 4, privacyAccepted: true, biometricAccepted: false,
    });
    expect(backendGet).toHaveBeenCalled();
});

test('a failing account list leaves the lists empty and stops loading', async () => {
    backendGet.mockRejectedValue(new Error('503'));

    const vm = await load();

    expect(vm().students).toEqual([]);
    expect(vm().loading).toBe(false);
});
