import BaseModel from '../BaseModel';

export default class AppUser extends BaseModel {
  constructor(data = {}) {
    super(data);
    // El backend responde camelCase (userId, personId...): se aceptan ambas
    // formas porque varios servicios llaman fromApi sin normalizar.
    this.userId = data.user_id || data.userId || null;
    this.personId = data.person_id || data.personId || null;
    this.username = data.username || '';
    this.authenticationType = data.authentication_type || data.authenticationType || 'Local';
    this.status = data.status !== undefined ? data.status : true;
    this.lastAccess = data.last_access || data.lastAccess || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new AppUser(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      user_id: this.userId,
      person_id: this.personId,
      username: this.username,
      authentication_type: this.authenticationType,
      status: this.status,
      last_access: this.lastAccess,
    };
  }
}
