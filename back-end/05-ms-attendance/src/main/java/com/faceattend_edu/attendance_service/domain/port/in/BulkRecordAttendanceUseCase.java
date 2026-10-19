package com.faceattend_edu.attendance_service.domain.port.in;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import java.util.List;

public interface BulkRecordAttendanceUseCase {
    List<AttendanceRecord> bulk(List<AttendanceRecord> records);
}
