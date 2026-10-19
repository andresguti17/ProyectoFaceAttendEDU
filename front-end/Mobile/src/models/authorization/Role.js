import BaseModel from '../BaseModel';

export default class Role extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.roleId = data.role_id || null;
    this.roleName = data.role_name || '';
    this.description = data.description || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new Role(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      role_id: this.roleId,
      role_name: this.roleName,
      description: this.description,
    };
  }
}
