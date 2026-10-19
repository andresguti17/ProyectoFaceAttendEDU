package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateEnvironmentRequest {
    private Integer schoolId;
    @Size(max=50) private String code;
    @Size(max=255) private String name;
    private Short capacity;
    private Boolean status;
}
