package com.faceattend_edu.authorization_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreatePermissionRequest {
    @NotBlank
    @Size(max = 255)
    private String permissionName;
    @Size(max = 500)
    private String description;
}
