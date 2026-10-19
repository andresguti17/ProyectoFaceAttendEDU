package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
public class UpdateAttendanceRecordRequest {
    private String attendanceStatus;
    private String captureMethod;
    private BigDecimal matchScore;
    private Instant capturedAt;
}
