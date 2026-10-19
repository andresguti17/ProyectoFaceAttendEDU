package com.faceattend_edu.scheduling_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateEnvironmentRequest {
    @NotNull private Integer schoolId;
    @NotBlank @Size(max=50) private String code;
    @NotBlank @Size(max=255) private String name;
    @NotNull @Positive private Short capacity;
    private Boolean status = true;
}
