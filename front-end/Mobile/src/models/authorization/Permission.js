import BaseModel from '../BaseModel';

export default class Permission extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.permissionId = data.permission_id || null;
    this.permissionName = data.permission_name || '';
    this.description = data.description || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new Permission(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      permission_id: this.permissionId,
      permission_name: this.permissionName,
      description: this.description,
    };
  }
}
