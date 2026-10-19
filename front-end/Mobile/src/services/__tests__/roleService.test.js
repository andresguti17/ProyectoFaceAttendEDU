jest.mock('../../api/apiClient', () => ({
  request: jest.fn(),
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
}));

import {request} from '../../api/apiClient';
import {RoleService} from '../RoleService';

beforeEach(() => {
  jest.clearAllMocks();
});

test('getAll mapea roleId/roleName camelCase del backend Java', async () => {
  request.mockResolvedValue([
    {roleId: 1, roleName: 'Administrador', description: 'd'},
    {roleId: 2, roleName: 'Instructor', description: 'd'},
  ]);

  const roles = await RoleService.getAll();

  expect(roles[0].roleId).toBe(1);
  expect(roles[0].roleName).toBe('Administrador');
  expect(roles[1].roleId).toBe(2);
});

test('getById normaliza la respuesta', async () => {
  request.mockResolvedValue({roleId: 3, roleName: 'Aprendiz'});

  const role = await RoleService.getById(3);

  expect(role.roleId).toBe(3);
  expect(role.roleName).toBe('Aprendiz');
});
