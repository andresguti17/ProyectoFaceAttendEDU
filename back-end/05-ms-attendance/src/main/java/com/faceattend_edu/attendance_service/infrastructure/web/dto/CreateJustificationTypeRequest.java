package com.faceattend_edu.attendance_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateJustificationTypeRequest {
    private Integer schoolId;
    @NotBlank @Size(max=255) private String name;
    @Size(max=500) private String description;
    private Boolean requiresAttachment = false;
    private Boolean status = true;
}
