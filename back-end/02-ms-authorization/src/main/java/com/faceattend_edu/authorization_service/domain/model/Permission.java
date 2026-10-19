package com.faceattend_edu.authorization_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Permission {
    private Integer permissionId;
    private String permissionName;
    private String description;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    public void validate() {
        if (isBlank(permissionName)) throw new IllegalArgumentException("permissionName is required");
        if (permissionName.length() > 255) throw new IllegalArgumentException("permissionName max 255");
        if (description != null && description.length() > 500) throw new IllegalArgumentException("description max 500");
    }

    public void touchCreated() {
        if (createdAt == null) createdAt = Instant.now();
        if (rowVersion == 0) rowVersion = 1L;
    }

    public void touchUpdated() {
        // row_version lo gestiona Hibernate via @Version; incrementarlo aqui rompe el merge.
        updatedAt = Instant.now();
    }

    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Permission)) return false;
        Permission p = (Permission) o;
        return Objects.equals(permissionId, p.permissionId);
    }
    @Override public int hashCode() { return Objects.hash(permissionId); }
}
