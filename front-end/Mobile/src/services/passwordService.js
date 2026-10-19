import { request, POST } from '../api/apiClient';

export class PasswordUpdateError extends Error {
  constructor(type, message) {
    super(message);
    this.type = type;
    this.name = 'PasswordUpdateError';
  }
}

export const PasswordService = {
  updatePassword: async (email, newPassword) => {
    return request({
      method: POST,
      url: 'auth/reset-password',
      data: { email, password: newPassword },
      requiresAuth: false,
    });
  },

  // Cambio desde el perfil: identity toma el usuario de la sesión y exige la contraseña actual.
  changePassword: async (currentPassword, newPassword) => {
    return request({
      method: POST,
      url: 'api/v1/auth/change-password',
      data: { currentPassword, newPassword },
    });
  },
};
