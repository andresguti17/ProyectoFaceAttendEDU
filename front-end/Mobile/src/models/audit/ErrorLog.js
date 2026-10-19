import BaseModel from '../BaseModel';

export default class ErrorLog extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.errorId = data.error_id || null;
    this.schoolId = data.school_id || null;
    this.userId = data.user_id || null;
    this.errorType = data.error_type || '';
    this.description = data.description || '';
    this.sourceIp = data.source_ip || null;
    this.application = data.application || null;
    this.occurredAt = data.occurred_at || null;
  }

  static fromApi(data) {
    if (!data) return null;
    return new ErrorLog(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      error_id: this.errorId,
      school_id: this.schoolId,
      user_id: this.userId,
      error_type: this.errorType,
      description: this.description,
      source_ip: this.sourceIp,
      application: this.application,
      occurred_at: this.occurredAt,
    };
  }
}
