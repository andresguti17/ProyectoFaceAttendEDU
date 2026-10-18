import { backendGet } from '../api/backend';
import ENV from '../config/env';
import i18n from '../utils/i18n';
import { getAcademicActorMap, getPersonCached } from './JustificationService';

const ALERTS_LIMIT = 200;

/**
 * Alertas de 08-notification. El servicio ya las acota por rol: el Aprendiz ve
 * las suyas, el Instructor las de los aprendices de sus fichas y el
 * Administrador todas. Devuelve [{ id, title, person, raisedAt, resolved }],
 * abiertas y recientes primero.
 */
export async function loadScopedAlerts() {
  const raw = await backendGet(ENV.NOTIFY_BASE_URL, 'api/v1/alerts', { limit: ALERTS_LIMIT });

  const [types, actorMap] = await Promise.all([
    backendGet(ENV.NOTIFY_BASE_URL, 'api/v1/alert-types').catch(() => []),
    getAcademicActorMap(),
  ]);
  // Título en el idioma de la app por código del tipo; el nombre del catálogo (inglés) es el respaldo.
  const typeName = Object.fromEntries(types.map((at) => [at.alert_type_id, i18n.t(`news.alertTypes.${at.code}`, { defaultValue: at.name })]));
  const typeCode = Object.fromEntries(types.map((at) => [at.alert_type_id, at.code]));
  const alerts = await Promise.all(raw.filter((a) => a?.alert_id != null).map(async (a) => {
    const person = await getPersonCached(actorMap[String(a.academic_actor_id)]?.person_id);
    return {
      id: a.alert_id,
      title: typeName[a.alert_type_id] || '',
      code: typeCode[a.alert_type_id] || null,
      person: `${person?.name || ''} ${person?.last_name || ''}`.trim(),
      raisedAt: a.raised_at,
      resolved: !!a.resolved_at,
    };
  }));
  return alerts.sort((x, y) => Number(x.resolved) - Number(y.resolved)
    || String(y.raisedAt || '').localeCompare(String(x.raisedAt || '')));
}
