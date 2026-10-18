jest.mock('../PersonService', () => ({PersonService: {create: jest.fn(), delete: jest.fn()}}));
jest.mock('../UserService', () => ({UserService: {create: jest.fn()}}));
jest.mock('../RoleService', () => ({RoleService: {getAll: jest.fn()}}));
jest.mock('../UserRoleService', () => ({UserRoleService: {assign: jest.fn()}}));
jest.mock('../ActorService', () => ({ActorService: {create: jest.fn()}}));

import {PersonService} from '../PersonService';
import {UserService} from '../UserService';
import {RoleService} from '../RoleService';
import {UserRoleService} from '../UserRoleService';
import {ActorService} from '../ActorService';
import {StaffService} from '../StaffService';

const base = {
  name: 'Ana García López',
  code: 'ADMIN001',
  documentNumber: '1234567890',
  email: 'Ana@universidad.edu',
  phone: null,
  password: 'Secret123',
};

beforeEach(() => {
  jest.clearAllMocks();
  PersonService.create.mockResolvedValue({personId: 'person-1'});
  UserService.create.mockResolvedValue({userId: 'user-1'});
  RoleService.getAll.mockResolvedValue([
    {roleId: 1, roleName: 'Administrador'},
    {roleId: 2, roleName: 'Instructor'},
  ]);
});

test('admin: crea persona, usuario, rol y actor ADMIN de sede', async () => {
  const result = await StaffService.createStaff({...base, role: 'admin', schoolId: 5});

  expect(result).toEqual({personId: 'person-1', userId: 'user-1'});
  expect(PersonService.create).toHaveBeenCalledWith({
    documentNumber: '1234567890',
    name: 'Ana',
    lastName: 'García López',
    email: 'ana@universidad.edu',
    phone: null,
    status: true,
  });
  expect(UserService.create).toHaveBeenCalledWith({
    personId: 'person-1',
    username: 'ana',
    password: 'Secret123',
    authenticationType: 'Local',
  });
  expect(UserRoleService.assign).toHaveBeenCalledWith('user-1', 1);
});

test('teacher: además crea el actor instructor en la sede', async () => {
  await StaffService.createStaff({...base, role: 'teacher', schoolId: 5});

  expect(ActorService.create).toHaveBeenCalledWith({
    personId: 'person-1',
    actorTypeId: 2,
    schoolId: 5,
    actorCode: 'ADMIN001',
    status: true,
  });
  expect(UserRoleService.assign).toHaveBeenCalledWith('user-1', 2);
});

test('admin: crea el actor ADMIN vinculado a la sede', async () => {
  await StaffService.createStaff({...base, role: 'admin', schoolId: 5});

  expect(ActorService.create).toHaveBeenCalledWith({
    personId: 'person-1',
    actorTypeId: 3,
    schoolId: 5,
    actorCode: 'ADMIN001',
    status: true,
  });
  expect(UserRoleService.assign).toHaveBeenCalledWith('user-1', 1);
});

test('admin sin sede falla en vez de quedar global', async () => {
  await expect(StaffService.createStaff({...base, role: 'admin', schoolId: null})).rejects.toThrow(
    'No school context'
  );
  expect(ActorService.create).not.toHaveBeenCalled();
});

test('compensa la persona si falla la creación del usuario', async () => {
  UserService.create.mockRejectedValueOnce(new Error('duplicate'));

  await expect(StaffService.createStaff({...base, role: 'admin'})).rejects.toThrow('duplicate');
  expect(PersonService.delete).toHaveBeenCalledWith('person-1');
});
