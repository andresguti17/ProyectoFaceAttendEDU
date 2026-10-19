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
public class Role {
    private Integer roleId;
    private String roleName;
    private String description;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    public void validate() {
        if (isBlank(roleName)) throw new IllegalArgumentException("roleName is required");
        if (roleName.length() > 255) throw new IllegalArgumentException("roleName max 255");
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
        if (!(o instanceof Role)) return false;
        Role r = (Role) o;
        return Objects.equals(roleId, r.roleId);
    }
    @Override public int hashCode() { return Objects.hash(roleId); }
}
