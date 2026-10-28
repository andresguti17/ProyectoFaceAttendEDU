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
 * BLOCKED (menor con el registro incompleto; step = GUARDIAN, DOCUMENT o TERMS).
 */
export function resolveTermsGate(enablement) {
  if (!enablement || enablement.enabled === true) {
    return { gate: TERMS_GATE.NONE, step: 'NONE', minor: enablement?.minor === true };
  }
  const minor = enablement.minor === true;
  const step = ['GUARDIAN', 'DOCUMENT'].includes(enablement.pendingStep) ? enablement.pendingStep : 'TERMS';
  return { gate: minor ? TERMS_GATE.BLOCKED : TERMS_GATE.ACCEPT, step, minor };
}

export const TermsService = {
  get: (personId) => request({ method: GET, url: `api/v1/persons/${personId}/terms` }),

  accept: (personId) => request({
    method: POST,
    url: `api/v1/persons/${personId}/terms`,
    data: { termsVersion: TERMS_VERSION },
  }),

  /**
   * Estado de la persona tras el login. Falla cerrado: sin persona o sin respuesta de identity
   * no se sabe si ya firmó, y dejarla entrar sin términos es un vacío legal. Lanza un error con
   * code TERMS_UNAVAILABLE y quien llama no abre la sesión.
   */
  gateFor: async (personId) => {
    if (!personId) throw termsUnavailable();
    let enablement;
    try {
      enablement = await TermsService.get(personId);
    } catch (cause) {
      throw termsUnavailable(cause);
    }
    if (!enablement || typeof enablement.enabled !== 'boolean') throw termsUnavailable();
    return resolveTermsGate(enablement);
  },
};

function termsUnavailable(cause) {
  const error = new Error('No se pudo verificar la aceptación de los términos');
  error.code = 'TERMS_UNAVAILABLE';
  error.cause = cause;
  return error;
}
