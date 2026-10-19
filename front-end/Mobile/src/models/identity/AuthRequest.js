import BaseModel from '../BaseModel';

// El backend acepta el identificador de login como { email } o { username };
// Mobile siempre envía el valor del campo de correo.
export default class AuthRequest extends BaseModel {
  constructor(data = {}) {
    super();
    this.email = data.email || data.username || '';
    this.password = data.password || '';
  }

  static fromCredentials(email, password) {
    return new AuthRequest({ email, password });
  }

  toApi() {
    return {
      email: this.email,
      password: this.password,
    };
  }
}
