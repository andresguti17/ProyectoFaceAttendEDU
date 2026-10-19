import BaseModel from '../BaseModel';

export default class Cohort extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.cohortId = data.cohort_id || null;
    this.programId = data.program_id || null;
    this.academicPeriodId = data.academic_period_id || null;
    this.code = data.code || '';
    this.status = data.status !== undefined ? data.status : true;
  }

  static fromApi(data) {
    if (!data) return null;
    return new Cohort(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      cohort_id: this.cohortId,
      program_id: this.programId,
      academic_period_id: this.academicPeriodId,
      code: this.code,
      status: this.status,
    };
  }
}
