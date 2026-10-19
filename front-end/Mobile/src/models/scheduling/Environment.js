import BaseModel from '../BaseModel';

export default class Environment extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.environmentId = data.environment_id || null;
    this.schoolId = data.school_id || null;
    this.code = data.code || '';
    this.name = data.name || '';
    this.capacity = data.capacity || 0;
    this.status = data.status !== undefined ? data.status : true;
  }

  static fromApi(data) {
    if (!data) return null;
    return new Environment(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      environment_id: this.environmentId,
      school_id: this.schoolId,
      code: this.code,
      name: this.name,
      capacity: this.capacity,
      status: this.status,
    };
  }
}
