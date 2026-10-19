import BaseModel from '../BaseModel';

export default class Alert extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.alertId = data.alert_id || null;
    this.academicActorId = data.academic_actor_id || null;
    this.alertTypeId = data.alert_type_id || null;
    this.raisedAt = data.raised_at || null;
    this.resolvedAt = data.resolved_at || null;
  }

  get isResolved() {
    return this.resolvedAt !== null;
  }

  get statusLabel() {
    return this.isResolved ? 'Resuelta' : 'Activa';
  }

  static fromApi(data) {
    if (!data) return null;
    return new Alert(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      alert_id: this.alertId,
      academic_actor_id: this.academicActorId,
      alert_type_id: this.alertTypeId,
      raised_at: this.raisedAt,
      resolved_at: this.resolvedAt,
    };
  }
}
