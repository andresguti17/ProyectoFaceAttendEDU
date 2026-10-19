import BaseModel from '../BaseModel';

export default class ClassSession extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.classSessionId = data.class_session_id || null;
    this.scheduleBlockId = data.schedule_block_id || null;
    this.sessionDate = data.session_date || null;
    this.openedBy = data.opened_by || null;
    this.openedAt = data.opened_at || null;
    this.closedBy = data.closed_by || null;
    this.closedAt = data.closed_at || null;
    this.sessionStatus = data.session_status || 'Open';
  }

  get isOpen() {
    return this.sessionStatus === 'Open';
  }

  get isClosed() {
    return this.sessionStatus === 'Closed';
  }

  get isCancelled() {
    return this.sessionStatus === 'Cancelled';
  }

  static fromApi(data) {
    if (!data) return null;
    return new ClassSession(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      class_session_id: this.classSessionId,
      schedule_block_id: this.scheduleBlockId,
      session_date: this.sessionDate,
      opened_by: this.openedBy,
      opened_at: this.openedAt,
      closed_by: this.closedBy,
      closed_at: this.closedAt,
      session_status: this.sessionStatus,
    };
  }
}
