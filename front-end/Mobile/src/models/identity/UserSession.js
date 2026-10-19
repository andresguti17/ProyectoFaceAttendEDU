import BaseModel from '../BaseModel';

export default class UserSession extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.sessionId = data.session_id || null;
    this.userId = data.user_id || null;
    this.startDate = data.start_date || null;
    this.endDate = data.end_date || null;
    this.sourceIp = data.source_ip || null;
    this.sessionStatus = data.session_status || 'Active';
  }

  get isActive() {
    return this.sessionStatus === 'Active';
  }

  get duration() {
    if (!this.startDate) return null;
    const end = this.endDate ? new Date(this.endDate) : new Date();
    return end - new Date(this.startDate);
  }

  static fromApi(data) {
    if (!data) return null;
    return new UserSession(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      session_id: this.sessionId,
      user_id: this.userId,
      start_date: this.startDate,
      end_date: this.endDate,
      source_ip: this.sourceIp,
      session_status: this.sessionStatus,
    };
  }
}
