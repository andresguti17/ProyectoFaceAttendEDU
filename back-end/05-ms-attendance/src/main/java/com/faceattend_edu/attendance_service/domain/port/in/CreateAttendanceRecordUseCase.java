package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;

public interface CreateAttendanceRecordUseCase {
    AttendanceRecord create(AttendanceRecord record);
}
