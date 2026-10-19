package com.faceattend_edu.authorization_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateRoleRequest {
    @NotBlank
    @Size(max = 255)
    private String roleName;
    @Size(max = 500)
    private String description;
}
