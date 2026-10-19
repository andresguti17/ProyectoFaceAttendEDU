package com.faceattend_edu.authorization_service.infrastructure.web.dto;

import lombok.Data;
import java.time.Instant;
import java.util.UUID;

@Data
public class PermissionResponse {
    private Integer permissionId;
    private String permissionName;
    private String description;
    private Instant createdAt;
    private Instant updatedAt;
    private UUID createdBy;
    private long rowVersion;
}
