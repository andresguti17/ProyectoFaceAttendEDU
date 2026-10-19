package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.Instant;

@Data
public class AttendanceRecordResponse {
    private Long attendanceRecordId;
    private Long classSessionId;
    private Long academicActorId;
    private String attendanceStatus;
    private String captureMethod;
    private Instant capturedAt;
    private BigDecimal matchScore;
    private Instant createdAt;
    private long rowVersion;
}
