import BaseModel from '../BaseModel';

export default class Enrollment extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.enrollmentId = data.enrollment_id || null;
    this.academicActorId = data.academic_actor_id || null;
    this.cohortId = data.cohort_id || null;
    this.enrolledOn = data.enrolled_on || null;
    this.enrollmentStatus = data.enrollment_status || 'Active';
  }

  get isActive() {
    return this.enrollmentStatus === 'Active';
  }

  get isCompleted() {
    return this.enrollmentStatus === 'Completed';
  }

  get isWithdrawn() {
    return this.enrollmentStatus === 'Withdrawn';
  }

  static fromApi(data) {
    if (!data) return null;
    return new Enrollment(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      enrollment_id: this.enrollmentId,
      academic_actor_id: this.academicActorId,
      cohort_id: this.cohortId,
      enrolled_on: this.enrolledOn,
      enrollment_status: this.enrollmentStatus,
    };
  }
}
