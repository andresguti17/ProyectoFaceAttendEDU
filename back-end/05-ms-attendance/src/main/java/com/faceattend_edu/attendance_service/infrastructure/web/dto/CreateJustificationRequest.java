package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateJustificationRequest {
    @NotNull private Long attendanceRecordId;
    @NotNull private Integer justificationTypeId;
    @NotBlank private String reason;
}
