import BaseModel from '../BaseModel';

export default class BiometricUpdateCase extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.caseId = data.case_id || null;
    this.personId = data.person_id || null;
    this.biometricType = data.biometric_type || 'FACIAL';
    this.fingerNumber = data.finger_number || null;
    this.currentEmbeddingRef = data.current_embedding_ref || null;
    this.reason = data.reason || '';
    this.updateStatus = data.update_status || 'Pending';
    this.requestedBy = data.requested_by || null;
    this.requestedAt = data.requested_at || null;
    this.reviewedBy = data.reviewed_by || null;
    this.reviewedAt = data.reviewed_at || null;
    this.resolutionNotes = data.resolution_notes || null;
  }

  get isPending() {
    return this.updateStatus === 'Pending';
  }

  get isInReview() {
    return this.updateStatus === 'In_Review';
  }

  get isApproved() {
    return this.updateStatus === 'Approved';
  }

  get isRejected() {
    return this.updateStatus === 'Rejected';
  }

  get isFacial() {
    return this.biometricType === 'FACIAL';
  }

  get isFingerprint() {
    return this.biometricType === 'FINGERPRINT';
  }

  static fromApi(data) {
    if (!data) return null;
    return new BiometricUpdateCase(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      case_id: this.caseId,
      person_id: this.personId,
      biometric_type: this.biometricType,
      finger_number: this.fingerNumber,
      current_embedding_ref: this.currentEmbeddingRef,
      reason: this.reason,
      update_status: this.updateStatus,
      requested_by: this.requestedBy,
      requested_at: this.requestedAt,
      reviewed_by: this.reviewedBy,
      reviewed_at: this.reviewedAt,
      resolution_notes: this.resolutionNotes,
    };
  }
}
