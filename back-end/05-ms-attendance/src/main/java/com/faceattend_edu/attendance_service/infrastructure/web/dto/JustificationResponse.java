package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class JustificationResponse {
    private Long justificationId;
    private Long attendanceRecordId;
    private Integer justificationTypeId;
    private String reason;
    private Instant submittedAt;
    private UUID reviewedBy;
    private Instant reviewedAt;
    private String reviewStatus;
    private String resolutionNotes;
    private Instant createdAt;
    private long rowVersion;
}
