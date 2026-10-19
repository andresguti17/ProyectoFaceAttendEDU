package com.faceattend_edu.authorization_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class RolePermission {
    private Integer roleId;
    private Integer permissionId;
    private Instant assignmentDate;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    public void touchCreated() {
        if (assignmentDate == null) assignmentDate = Instant.now();
        if (createdAt == null) createdAt = Instant.now();
        if (rowVersion == 0) rowVersion = 1L;
    }
}
