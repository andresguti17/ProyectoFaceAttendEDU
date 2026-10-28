import { request } from '../../api/apiClient';
import { changeRole, createAccount } from '../userProvisioning';

jest.mock('../../api/apiClient', () => ({
  request: jest.fn(),
  GET: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE',
}));

const ROLES = [{ roleId: 1, roleName: 'Administrador' }, { roleId: 2, roleName: 'Instructor' }, { roleId: 3, roleName: 'Aprendiz' }];

function route(handlers) {
  request.mockImplementation(async ({ method, url }) => {
    const key = `${method} ${url}`;
    const handler = handlers.find(([pattern]) => (pattern instanceof RegExp ? pattern.test(key) : pattern === key));
    if (!handler) throw new Error(`unexpected ${key}`);
    return typeof handler[1] === 'function' ? handler[1]() : handler[1];
  });
}

const calls = () => request.mock.calls.map(([c]) => `${c.method} ${c.url}`);

beforeEach(() => request.mockReset());

describe('createAccount', () => {
  it('sends one provisioning call with person, role and academic actor', async () => {
    route([['POST api/v1/users/provision', { userId: 'u-1', personId: 'p-1', academicActorId: 9 }]]);

    const result = await createAccount({
      name: 'Ana', lastName: 'Ruiz', documentNumber: '1001', email: '', phone: null,
      username: 'ana.ruiz', password: 'Secret1!x', roleName: 'Aprendiz', schoolId: '3',
      privacyAccepted: true, biometricAccepted: true,
    });

    expect(result).toEqual({ userId: 'u-1', personId: 'p-1' });
    expect(calls()).toEqual(['POST api/v1/users/provision']);
    expect(request.mock.calls[0][0].data).toEqual({
      person: { documentNumber: '1001', name: 'Ana', lastName: 'Ruiz' },
      username: 'ana.ruiz',
      password: 'Secret1!x',
      roleName: 'Aprendiz',
      consent: { policyVersion: '2026-11', biometricAccepted: true },
      academicActor: { actorTypeId: 1, schoolId: 3, actorCode: '1001' },
    });
  });

  it('sends no academic actor for administrators and surfaces the server error (nothing left half-created)', async () => {
    route([['POST api/v1/users/provision', () => { throw new Error('username taken'); }]]);

    await expect(createAccount({ name: 'A', lastName: 'B', documentNumber: '2', username: 'x', password: 'p', roleName: 'Administrador', privacyAccepted: true }))
      .rejects.toThrow('username taken');
    expect(request.mock.calls[0][0].data.academicActor).toBeUndefined();
    expect(calls()).toEqual(['POST api/v1/users/provision']);
  });
});

describe('createAccount without the privacy notice', () => {
  it('is refused before any call (Ley 1581)', async () => {
    await expect(createAccount({ name: 'A', lastName: 'B', documentNumber: '2', username: 'x', password: 'p', roleName: 'Aprendiz' }))
      .rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('changeRole', () => {
  it('assigns the new role before removing the old one and realigns the actor type', async () => {
    route([
      ['GET api/v1/roles', ROLES],
      ['POST api/v1/users/u-1/roles', null],
      ['DELETE api/v1/users/u-1/roles/3', null],
      ['GET api/v1/academic-actors', [{ academicActorId: 7, personId: 'p-1', actorTypeId: 1 }]],
      ['PUT api/v1/academic-actors/7', null],
    ]);

    await changeRole({ userId: 'u-1', personId: 'p-1', currentRoles: [{ role_id: 3, role_name: 'Aprendiz' }], roleName: 'Instructor' });

    expect(calls()).toEqual([
      'GET api/v1/roles', 'POST api/v1/users/u-1/roles', 'DELETE api/v1/users/u-1/roles/3', 'GET api/v1/academic-actors', 'PUT api/v1/academic-actors/7',
    ]);
    expect(request.mock.calls[4][0].data).toEqual({ actorTypeId: 2 });
  });
});
