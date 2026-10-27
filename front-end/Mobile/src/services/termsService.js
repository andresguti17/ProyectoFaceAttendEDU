// Términos y condiciones: identity guarda cada aceptación (versión, fecha, tipo de usuario,
// quién la registró y en qué sede). Un adulto firma los suyos una vez (y de nuevo si cambia la
// versión); los de un menor los registra el administrador de la sede con el acudiente presente,
// por eso la app solo le muestra el paso pendiente.
import { request, GET, POST } from '../api/apiClient';

// Debe coincidir con faceattend.terms.version de ms-identity.
export const TERMS_VERSION = '2026-10';

export const TERMS_GATE = { NONE: 'NONE', ACCEPT: 'ACCEPT', BLOCKED: 'BLOCKED' };

/**
 * Qué ve la persona al ingresar: NONE (habilitada), ACCEPT (adulto que debe firmar) o
 * BLOCKED (menor con el registro incompleto; step = GUARDIAN o TERMS).
 */
export function resolveTermsGate(enablement) {
  if (!enablement || enablement.enabled === true) {
    return { gate: TERMS_GATE.NONE, step: 'NONE', minor: enablement?.minor === true };
  }
  const minor = enablement.minor === true;
  const step = enablement.pendingStep === 'GUARDIAN' ? 'GUARDIAN' : 'TERMS';
  return { gate: minor ? TERMS_GATE.BLOCKED : TERMS_GATE.ACCEPT, step, minor };
}

export const TermsService = {
  get: (personId) => request({ method: GET, url: `api/v1/persons/${personId}/terms` }),

  accept: (personId) => request({
    method: POST,
    url: `api/v1/persons/${personId}/terms`,
    data: { termsVersion: TERMS_VERSION },
  }),

  /** Estado de la persona tras el login. Si identity no responde no se bloquea el ingreso. */
  gateFor: async (personId) => {
    if (!personId) return { gate: TERMS_GATE.NONE, step: 'NONE', minor: false };
    try {
      return resolveTermsGate(await TermsService.get(personId));
    } catch {
      return { gate: TERMS_GATE.NONE, step: 'NONE', minor: false };
    }
  },
};
