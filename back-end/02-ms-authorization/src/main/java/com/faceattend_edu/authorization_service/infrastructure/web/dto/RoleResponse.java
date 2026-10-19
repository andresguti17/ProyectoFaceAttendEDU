package com.faceattend_edu.authorization_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class RoleResponse {
    private Integer roleId;
    private String roleName;
    private String description;
    private Instant createdAt;
    private Instant updatedAt;
    private UUID createdBy;
    private long rowVersion;
}
