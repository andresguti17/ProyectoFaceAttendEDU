import { request, GET, POST, PUT, DELETE } from '../api/apiClient';
import { toSnakeDeep } from '../api/backend';
import i18n from '../utils/i18n';
import { PRIVACY_POLICY_VERSION } from './consentService';

// Tipos de actor académico sembrados en 03 (001-seed-academic-actor-type-table).
const ACTOR_TYPE_BY_ROLE = { Aprendiz: 1, Instructor: 2 };

const list = (data) => (Array.isArray(data) ? data : data ? [data] : []).map((item) => toSnakeDeep(item));

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
 * Alta completa de una cuenta (HU-IAM-002) en una sola llamada: identity crea
 * persona y usuario y pide a authorization el rol y, para Aprendiz/Instructor
 * con sede, a academic el actor. Si un paso falla, el servidor deshace los
 * anteriores (no quedan cuentas a medias) y la app solo muestra el motivo.
 */
export async function createAccount({ name, lastName, documentNumber, email, phone, username, password, roleName, schoolId, privacyAccepted = false, biometricAccepted = false }) {
  // Ley 1581: sin la aceptación del aviso de privacidad no se crea la cuenta.
  if (!privacyAccepted) throw new Error(i18n.t('privacyConsent.requiredForAccount'));
  const actorTypeId = ACTOR_TYPE_BY_ROLE[roleName];
  const result = toSnakeDeep(await request({
    method: POST,
    url: 'api/v1/users/provision',
    timeoutMs: 60000,
    data: {
      person: { documentNumber, name, lastName, ...(email ? { email } : {}), ...(phone ? { phone } : {}) },
      username,
      password,
      roleName,
      consent: { policyVersion: PRIVACY_POLICY_VERSION, biometricAccepted: biometricAccepted === true },
      ...(actorTypeId && schoolId
        ? { academicActor: { actorTypeId, schoolId: Number(schoolId), actorCode: documentNumber } }
        : {}),
    },
  }));
  return { userId: result.user_id, personId: result.person_id };
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
