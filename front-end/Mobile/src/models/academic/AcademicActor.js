import BaseModel from '../BaseModel';

export default class AcademicActor extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.academicActorId = data.academic_actor_id || null;
    this.personId = data.person_id || null;
    this.actorTypeId = data.actor_type_id || null;
    this.schoolId = data.school_id || null;
    this.actorCode = data.actor_code || '';
    this.startedOn = data.started_on || null;
    this.endedOn = data.ended_on || null;
    this.status = data.status !== undefined ? data.status : true;
  }

  get isStudent() {
    return this.actorCode?.toUpperCase().includes('STUDENT') || false;
  }

  get isInstructor() {
    return this.actorCode?.toUpperCase().includes('INSTRUCTOR') || false;
  }

  static fromApi(data) {
    if (!data) return null;
    return new AcademicActor(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      academic_actor_id: this.academicActorId,
      person_id: this.personId,
      actor_type_id: this.actorTypeId,
      school_id: this.schoolId,
      actor_code: this.actorCode,
      started_on: this.startedOn,
      ended_on: this.endedOn,
      status: this.status,
    };
  }
}
