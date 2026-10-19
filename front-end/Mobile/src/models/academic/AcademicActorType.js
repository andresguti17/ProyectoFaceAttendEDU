import BaseModel from '../BaseModel';

export default class AcademicActorType extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.actorTypeId = data.actor_type_id || null;
    this.code = data.code || '';
    this.name = data.name || '';
  }

  static fromApi(data) {
    if (!data) return null;
    return new AcademicActorType(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      actor_type_id: this.actorTypeId,
      code: this.code,
      name: this.name,
    };
  }
}
