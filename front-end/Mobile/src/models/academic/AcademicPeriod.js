import BaseModel from '../BaseModel';

export default class AcademicPeriod extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.academicPeriodId = data.academic_period_id || null;
    this.schoolId = data.school_id || null;
    this.name = data.name || '';
    this.startsOn = data.starts_on || null;
    this.endsOn = data.ends_on || null;
    this.isActive = data.is_active !== undefined ? data.is_active : false;
  }

  static fromApi(data) {
    if (!data) return null;
    return new AcademicPeriod(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      academic_period_id: this.academicPeriodId,
      school_id: this.schoolId,
      name: this.name,
      starts_on: this.startsOn,
      ends_on: this.endsOn,
      is_active: this.isActive,
    };
  }
}
