package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateAttendanceRecordRequest {
    @NotNull private Long classSessionId;
    @NotNull private Long academicActorId;
    @NotNull private String attendanceStatus;
    @NotNull private String captureMethod;
    private BigDecimal matchScore;
}
