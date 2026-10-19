import BaseModel from '../BaseModel';

export default class AuditLog extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.auditLogId = data.audit_log_id || null;
    this.schoolId = data.school_id || null;
    this.actorId = data.actor_id || null;
    this.action = data.action || '';
    this.aggregateType = data.aggregate_type || '';
    this.aggregateId = data.aggregate_id || null;
    this.description = data.description || null;
    this.sourceIp = data.source_ip || null;
    this.application = data.application || null;
    this.occurredAt = data.occurred_at || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new AuditLog(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      audit_log_id: this.auditLogId,
      school_id: this.schoolId,
      actor_id: this.actorId,
      action: this.action,
      aggregate_type: this.aggregateType,
      aggregate_id: this.aggregateId,
      description: this.description,
      source_ip: this.sourceIp,
      application: this.application,
      occurred_at: this.occurredAt,
    };
  }
}
