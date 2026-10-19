import { request, POST } from '../api/apiClient';
import { VerificationErrorType, REQUEST_TIMEOUT_MS } from './constants/auths';
import { timeoutMessage } from '../api/httpErrors';

export class VerificationError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type;
    this.name = 'VerificationError';
  }
}

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new VerificationError(VerificationErrorType.TIMEOUT, timeoutMessage())), ms)
    ),
  ]);

export const VerificationService = {
  sendRecoveryCode: async (email) => {
    const normalized = email.toLowerCase().trim();

    return withTimeout(
      request({ method: POST, url: 'auth/forgot-password', data: { email: normalized }, requiresAuth: false }),
      REQUEST_TIMEOUT_MS
    );
  },

  verifyRecoveryCode: async (email, code) => {
    const normalized = email.toLowerCase().trim();

    return withTimeout(
      request({ method: POST, url: 'auth/verify-code', data: { email: normalized, code }, requiresAuth: false }),
      REQUEST_TIMEOUT_MS
    );
  },

  clearCode: (_email) => {
    // El backend gestiona la expiración/invalidación del código; no hay estado local que limpiar.
  },
};
