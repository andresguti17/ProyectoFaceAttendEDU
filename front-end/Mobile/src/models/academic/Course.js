import BaseModel from '../BaseModel';

export default class Course extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.courseId = data.course_id || null;
    this.programId = data.program_id || null;
    this.code = data.code || '';
    this.name = data.name || '';
    this.creditHours = data.credit_hours || 0;
    this.status = data.status !== undefined ? data.status : true;
  }

  static fromApi(data) {
    if (!data) return null;
    return new Course(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      course_id: this.courseId,
      program_id: this.programId,
      code: this.code,
      name: this.name,
      credit_hours: this.creditHours,
      status: this.status,
    };
  }
}
