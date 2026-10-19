package com.faceattend_edu.scheduling_service.domain.model;

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
public class Environment {
    private Integer environmentId;
    private Integer schoolId;
    private String code;
    private String name;
    private Short capacity;
    private Boolean status;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    public void validate() {
        if (schoolId == null) throw new IllegalArgumentException("schoolId is required");
        if (isBlank(code)) throw new IllegalArgumentException("code is required");
        if (code.length() > 50) throw new IllegalArgumentException("code max 50");
        if (isBlank(name)) throw new IllegalArgumentException("name is required");
        if (name.length() > 255) throw new IllegalArgumentException("name max 255");
        if (capacity == null) throw new IllegalArgumentException("capacity is required");
        if (capacity <= 0) throw new IllegalArgumentException("capacity must be > 0");
        if (status == null) throw new IllegalArgumentException("status is required");
    }

    public void touchCreated() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = true;
        if (rowVersion == 0) rowVersion = 1L;
    }

    public void touchUpdated() {
        updatedAt = Instant.now();
        // row_version is owned by JPA @Version (reinforced by fn_audit_timestamps trigger);
        // pre-incrementing it here makes merge() fail with StaleObjectStateException
    }

    private static boolean isBlank(String s) { return s == null || s.trim().isEmpty(); }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Environment)) return false;
        Environment that = (Environment) o;
        return Objects.equals(environmentId, that.environmentId);
    }
    @Override public int hashCode() { return Objects.hash(environmentId); }
}
