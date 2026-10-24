/**
 * Expo push delivery of alerts to the mobile app — 08-ms-notification.
 *
 * Every created alert (POST /alerts, the justification consumer, the at-risk
 * scheduler) is pushed to the actor's active devices, whatever the alert type
 * channel; the webhook keeps its own EMAIL/PUSH rule. Alerts carry no text, so
 * title and body come from the alert type code, in each device's locale.
 * Push is best effort: errors are logged and never fail alert creation.
 */
import type { AlertRecord } from '../../domain/entities/Alert';
import type { IAlertRepository } from '../../domain/ports/out/IAlertRepository';
import type { IAlertTypeRepository } from '../../domain/ports/out/IAlertTypeRepository';
import {
  DEVICE_LOCALES,
  type DeviceLocale,
  type IDeviceTokenRepository,
} from '../../domain/ports/out/IDeviceTokenRepository';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
export const EXPO_CHUNK_SIZE = 100;
const REQUEST_TIMEOUT_MS = 10_000;

export interface PushConfig {
  enabled: boolean;
  /** Expo access token; sent as a bearer only when set (needed if the project enforces push security). */
  accessToken: string;
}

export function pushConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PushConfig {
  return {
    enabled: (env.PUSH_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    accessToken: (env.EXPO_PUSH_ACCESS_TOKEN ?? '').trim(),
  };
}

export interface PushLogger {
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

export interface PushDeps {
  tokens: IDeviceTokenRepository;
  config: PushConfig;
  logger: PushLogger;
  fetch?: typeof fetch;
}

interface PushText {
  title: string;
  body: string;
}

// Spanish follows the alert descriptions of the app's alerts screen.
const TEMPLATES: Record<string, Record<DeviceLocale, PushText>> = {
  JUSTIFICATION_RESULT: {
    es: { title: 'Justificación resuelta', body: 'Se resolvió tu justificación. Revisa su estado.' },
    en: { title: 'Justification reviewed', body: 'Your justification was reviewed. Check its status.' },
    pt: { title: 'Justificativa resolvida', body: 'Sua justificativa foi resolvida. Confira o status.' },
    fr: { title: 'Justificatif traité', body: 'Votre justificatif a été traité. Consultez son statut.' },
  },
  JUSTIFICATION_PENDING: {
    es: { title: 'Justificaciones pendientes', body: 'Hay justificaciones pendientes de revisión.' },
    en: { title: 'Pending justifications', body: 'There are justifications waiting for review.' },
    pt: { title: 'Justificativas pendentes', body: 'Há justificativas aguardando revisão.' },
    fr: { title: 'Justificatifs en attente', body: "Des justificatifs attendent d'être examinés." },
  },
  JUSTIFICATION_APPROVED: {
    es: { title: 'Justificación aprobada', body: 'Tu justificación fue aprobada.' },
    en: { title: 'Justification approved', body: 'Your justification was approved.' },
    pt: { title: 'Justificativa aprovada', body: 'Sua justificativa foi aprovada.' },
    fr: { title: 'Justificatif approuvé', body: 'Votre justificatif a été approuvé.' },
  },
  JUSTIFICATION_REJECTED: {
    es: { title: 'Justificación rechazada', body: 'Tu justificación fue rechazada. Revisa su estado.' },
    en: { title: 'Justification rejected', body: 'Your justification was rejected. Check its status.' },
    pt: { title: 'Justificativa rejeitada', body: 'Sua justificativa foi rejeitada. Confira o status.' },
    fr: { title: 'Justificatif refusé', body: 'Votre justificatif a été refusé. Consultez son statut.' },
  },
  ATTENDANCE_ABSENTEEISM: {
    es: { title: 'Inasistencias recurrentes', body: 'Tienes inasistencias recurrentes. Revísalas en tu historial.' },
    en: { title: 'Recurring absences', body: 'You have recurring absences. Review them in your history.' },
    pt: { title: 'Faltas recorrentes', body: 'Você tem faltas recorrentes. Confira no seu histórico.' },
    fr: { title: 'Absences récurrentes', body: 'Vous avez des absences récurrentes. Consultez votre historique.' },
  },
  ATTENDANCE_TARDINESS: {
    es: { title: 'Tardanzas repetidas', body: 'Tienes tardanzas repetidas. Revísalas en tu historial.' },
    en: { title: 'Repeated tardiness', body: 'You have been late repeatedly. Review it in your history.' },
    pt: { title: 'Atrasos repetidos', body: 'Você tem atrasos repetidos. Confira no seu histórico.' },
    fr: { title: 'Retards répétés', body: 'Vous avez des retards répétés. Consultez votre historique.' },
  },
  ATTENDANCE_LOW: {
    es: { title: 'Asistencia baja', body: 'Tu asistencia está por debajo del mínimo. Urgente.' },
    en: { title: 'Low attendance', body: 'Your attendance is below the minimum. Urgent.' },
    pt: { title: 'Frequência baixa', body: 'Sua frequência está abaixo do mínimo. Urgente.' },
    fr: { title: 'Assiduité insuffisante', body: 'Votre assiduité est inférieure au minimum. Urgent.' },
  },
  BIOMETRIC_UPDATE: {
    es: { title: 'Actualización biométrica', body: 'Hay una solicitud biométrica relacionada contigo.' },
    en: { title: 'Biometric update', body: 'There is a biometric request related to you.' },
    pt: { title: 'Atualização biométrica', body: 'Há uma solicitação biométrica relacionada a você.' },
    fr: { title: 'Mise à jour biométrique', body: 'Une demande biométrique vous concerne.' },
  },
};

const GENERIC_BODY: Record<DeviceLocale, string> = {
  es: 'Tienes una nueva alerta. Ábrela en la app.',
  en: 'You have a new alert. Open the app to see it.',
  pt: 'Você tem um novo alerta. Abra o app para vê-lo.',
  fr: "Vous avez une nouvelle alerte. Ouvrez l'application pour la voir.",
};

/** Title and body for an alert type in a locale; unknown locales fall back to Spanish. */
export function pushText(code: string, name: string, locale: string): PushText {
  const lang: DeviceLocale = (DEVICE_LOCALES as readonly string[]).includes(locale) ? (locale as DeviceLocale) : 'es';
  const template = TEMPLATES[code.trim().toUpperCase()];
  return template ? template[lang] : { title: name, body: GENERIC_BODY[lang] };
}

interface ExpoTicket {
  status?: string;
  details?: { error?: string };
}

/** Sends one alert to every active device of its actor. Revokes tokens Expo reports as not registered. */
export async function sendAlertPush(
  deps: PushDeps,
  alert: Pick<AlertRecord, 'alertId' | 'academicActorId'>,
  alertType: { code: string; name: string },
): Promise<void> {
  if (!deps.config.enabled) return;
  const devices = await deps.tokens.findActiveByActor(alert.academicActorId);
  if (devices.length === 0) return;

  const messages = devices.map(({ token, locale }) => ({
    to: token,
    sound: 'default',
    ...pushText(alertType.code, alertType.name, locale),
    data: { alertId: alert.alertId, code: alertType.code },
  }));
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (deps.config.accessToken) headers.Authorization = `Bearer ${deps.config.accessToken}`;
  const doFetch = deps.fetch ?? fetch;

  const unregistered: string[] = [];
  for (let i = 0; i < messages.length; i += EXPO_CHUNK_SIZE) {
    const chunk = messages.slice(i, i + EXPO_CHUNK_SIZE);
    try {
      const res = await doFetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        deps.logger.error({ status: res.status, alertId: alert.alertId }, 'expo push request failed');
        continue;
      }
      const body = (await res.json()) as { data?: ExpoTicket[] };
      // Tickets come back in the order of the messages sent.
      (body.data ?? []).forEach((ticket, idx) => {
        if (ticket?.status !== 'error') return;
        const error = ticket.details?.error;
        if (error === 'DeviceNotRegistered' && chunk[idx]) unregistered.push(chunk[idx].to);
        // Ticket messages quote the token, so only the error code is logged.
        else deps.logger.warn({ alertId: alert.alertId, error }, 'expo push ticket error');
      });
    } catch (err) {
      deps.logger.error({ err, alertId: alert.alertId }, 'expo push request failed');
    }
  }
  if (unregistered.length > 0) await deps.tokens.revokeTokens(unregistered);
}

/**
 * The alert repository with push after each `create`, so every path that
 * raises an alert pushes it without knowing about push. Fire-and-forget: the
 * created alert is returned before the push runs.
 */
export function withAlertPush(
  alerts: IAlertRepository,
  alertTypes: IAlertTypeRepository,
  deps: PushDeps,
): IAlertRepository {
  // Inherits every other method (and its `this` state) from the real repository.
  const wrapped: IAlertRepository = Object.create(alerts);
  wrapped.create = async (draft) => {
    const created = await alerts.create(draft);
    if (deps.config.enabled) {
      void (async () => {
        const type = await alertTypes.findById(created.alertTypeId);
        if (!type) {
          deps.logger.warn({ alertId: created.alertId, alertTypeId: created.alertTypeId }, 'alert push skipped, unknown alert type');
          return;
        }
        await sendAlertPush(deps, created, type);
      })().catch((err) => deps.logger.error({ err, alertId: created.alertId }, 'alert push failed'));
    }
    return created;
  };
  return wrapped;
}
