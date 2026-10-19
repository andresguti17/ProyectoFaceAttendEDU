import BaseModel from '../BaseModel';

export default class AttendanceRecord extends BaseModel {
  constructor(data = {}) {
    super(data);
    this.attendanceRecordId = data.attendance_record_id || null;
    this.classSessionId = data.class_session_id || null;
    this.academicActorId = data.academic_actor_id || null;
    this.attendanceStatus = data.attendance_status || 'Absent';
    this.capturedAt = data.captured_at || null;
    this.captureMethod = data.capture_method || 'MANUAL';
    this.matchScore = data.match_score || null;
  }

  get isPresent() {
    return this.attendanceStatus === 'Present';
  }

  get isAbsent() {
    return this.attendanceStatus === 'Absent';
  }

  get isLate() {
    return this.attendanceStatus === 'Late';
  }

  get isJustified() {
    return this.attendanceStatus === 'Justified';
  }

  static fromApi(data) {
    if (!data) return null;
    return new AttendanceRecord(data);
  }

  toApi() {
    return {
      ...super.toApi(),
      attendance_record_id: this.attendanceRecordId,
      class_session_id: this.classSessionId,
      academic_actor_id: this.academicActorId,
      attendance_status: this.attendanceStatus,
      captured_at: this.capturedAt,
      capture_method: this.captureMethod,
      match_score: this.matchScore,
    };
  }
}
