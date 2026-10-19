package com.faceattend_edu.authorization_service.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AssignPermissionRequest {
    @NotNull
    private Integer permissionId;
}
