import BaseModel from '../BaseModel';

export default class RolePermission extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.roleId = data.role_id || null;
    this.permissionId = data.permission_id || null;
    this.assignmentDate = data.assignment_date || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new RolePermission(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      role_id: this.roleId,
      permission_id: this.permissionId,
      assignment_date: this.assignmentDate,
    };
  }
}
