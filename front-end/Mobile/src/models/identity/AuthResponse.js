import BaseModel from '../BaseModel';

export default class AuthResponse extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.token = data.token || null;
    this.refreshToken = data.refresh_token || null;
    this.tokenType = data.token_type || 'Bearer';
    this.expiresIn = data.expires_in || null;
    this.user = data.user || null;
    // La cuenta aún usa su contraseña inicial: hay que cambiarla antes de entrar.
    this.mustChangePassword = data.must_change_password === true;
  }

  get isExpired() {
    if (!this.expiresIn) return false;
    return Date.now() > this.expiresIn;
  }

  static fromApi(data) {
    if (!data) return null;
    return new AuthResponse(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      token: this.token,
      refresh_token: this.refreshToken,
      token_type: this.tokenType,
      expires_in: this.expiresIn,
      user: this.user,
      must_change_password: this.mustChangePassword,
    };
  }
}
