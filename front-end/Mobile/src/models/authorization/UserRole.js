import BaseModel from '../BaseModel';

export default class UserRole extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.userId = data.user_id || null;
    this.roleId = data.role_id || null;
    this.assignmentDate = data.assignment_date || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new UserRole(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      user_id: this.userId,
      role_id: this.roleId,
      assignment_date: this.assignmentDate,
    };
  }
}
