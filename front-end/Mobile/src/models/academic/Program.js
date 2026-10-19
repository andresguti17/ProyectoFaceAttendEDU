import BaseModel from '../BaseModel';

export default class Program extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.programId = data.program_id || null;
    this.schoolId = data.school_id || null;
    this.code = data.code || '';
    this.name = data.name || '';
    this.status = data.status !== undefined ? data.status : true;
  }

  static fromApi(data) {
    if (!data) return null;
    return new Program(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      program_id: this.programId,
      school_id: this.schoolId,
      code: this.code,
      name: this.name,
      status: this.status,
    };
  }
}
