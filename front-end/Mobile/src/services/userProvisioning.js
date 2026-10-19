import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import i18n from '../utils/i18n';

// Tipos de actor académico sembrados en 03 (001-seed-academic-actor-type-table).
const ACTOR_TYPE_BY_ROLE = { Aprendiz: 1, Instructor: 2 };

const list = (data) => (Array.isArray(data) ? data : data ? [data] : []).map(toSnakeDeep);

/** Roles del catálogo de authorization: [{ role_id, role_name }]. */
export async function listRoles() {
  return list(await request({ method: GET, url: 'api/v1/roles' }));
}

async function roleIdOf(roleName) {
  const role = (await listRoles()).find((r) => r.role_name === roleName);
  if (!role) throw new Error(i18n.t('manageUsers.roleNotFound', { role: roleName }));
  return role.role_id;
}

/**
 * Alta completa de una cuenta (HU-IAM-002): persona en identity, usuario con
 * contraseña inicial, rol en authorization y, para Aprendiz/Instructor, actor
 * académico en la sede. Cada paso depende del anterior; si uno falla se
 * informa cuál, para que el administrador corrija y reintente.
 */
export async function createAccount({ name, lastName, documentNumber, email, phone, username, password, roleName, schoolId }) {
  const step = async (label, fn) => {
    try {
      return await fn();
    } catch (error) {
      error.message = `${label}: ${error.message}`;
      throw error;
    }
  };
  const person = toSnakeDeep(await step(i18n.t('manageUsers.steps.person'), () => request({
    method: POST,
    url: 'api/v1/persons',
    data: { documentNumber, name, lastName, ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
  })));
  const user = toSnakeDeep(await step(i18n.t('manageUsers.steps.user'), () => request({
    method: POST,
    url: 'api/v1/users',
    data: { personId: person.person_id, username, password, authenticationType: 'Local' },
  })));
  const roleId = await step(i18n.t('manageUsers.steps.role'), () => roleIdOf(roleName));
  await step(i18n.t('manageUsers.steps.role'), () => request({ method: POST, url: `api/v1/users/${user.user_id}/roles`, data: { roleId } }));
  const actorTypeId = ACTOR_TYPE_BY_ROLE[roleName];
  if (actorTypeId && schoolId) {
    await step(i18n.t('manageUsers.steps.actor'), () => request({
      method: POST,
      url: 'api/v1/academic-actors',
      data: { personId: person.person_id, actorTypeId, schoolId: Number(schoolId), actorCode: documentNumber },
    }));
  }
  return { userId: user.user_id, personId: person.person_id };
}

/**
 * Cambio de rol (RN-08): asigna el nuevo antes de retirar los anteriores, para
 * que la cuenta nunca quede sin rol, y alinea el tipo del actor académico.
 */
export async function changeRole({ userId, personId, currentRoles = [], roleName }) {
  const roleId = await roleIdOf(roleName);
  if (!currentRoles.some((r) => r.role_id === roleId)) {
    await request({ method: POST, url: `api/v1/users/${userId}/roles`, data: { roleId } });
  }
  for (const old of currentRoles) {
    if (old.role_id !== roleId) await request({ method: DELETE, url: `api/v1/users/${userId}/roles/${old.role_id}` });
  }
  const actorTypeId = ACTOR_TYPE_BY_ROLE[roleName];
  if (actorTypeId && personId) {
    const actors = list(await request({ method: GET, url: 'api/v1/academic-actors', params: { limit: 2000 } }))
      .filter((a) => a.person_id === personId && a.actor_type_id !== actorTypeId);
    for (const actor of actors) {
      await request({ method: PUT, url: `api/v1/academic-actors/${actor.academic_actor_id}`, data: { actorTypeId } });
    }
  }
}
