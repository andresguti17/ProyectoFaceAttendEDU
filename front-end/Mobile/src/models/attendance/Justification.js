import BaseModel from '../BaseModel';

export default class Justification extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.justificationId = data.justification_id || null;
    this.attendanceRecordId = data.attendance_record_id || null;
    this.justificationTypeId = data.justification_type_id || null;
    this.reason = data.reason || '';
    this.submittedAt = data.submitted_at || null;
    this.reviewedBy = data.reviewed_by || null;
    this.reviewedAt = data.reviewed_at || null;
    this.reviewStatus = data.review_status || 'Pending';
    this.resolutionNotes = data.resolution_notes || null;
  }

  get isPending() {
    return this.reviewStatus === 'Pending';
  }

  get isApproved() {
    return this.reviewStatus === 'Approved';
  }

  get isRejected() {
    return this.reviewStatus === 'Rejected';
  }

  static fromApi(data) {
    if (!data) return null;
    return new Justification(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      justification_id: this.justificationId,
      attendance_record_id: this.attendanceRecordId,
      justification_type_id: this.justificationTypeId,
      reason: this.reason,
      submitted_at: this.submittedAt,
      reviewed_by: this.reviewedBy,
      reviewed_at: this.reviewedAt,
      review_status: this.reviewStatus,
    };
  }
}
