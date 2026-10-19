package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;

public interface ListAttendanceRecordsUseCase {
    AttendanceRecordSlice search(AttendanceRecordFilter filter, int offset, Integer limit);
}
