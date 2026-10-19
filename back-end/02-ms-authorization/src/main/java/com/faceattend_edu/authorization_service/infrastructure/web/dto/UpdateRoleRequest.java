package com.faceattend_edu.authorization_service.infrastructure.web.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateRoleRequest {
    @Size(max = 255)
    private String roleName;
    @Size(max = 500)
    private String description;
}
