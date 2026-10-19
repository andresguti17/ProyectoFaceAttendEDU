package com.faceattend_edu.attendance_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class JustificationType {
    private Integer justificationTypeId;
    private Integer schoolId;
    private String name;
    private String description;
    private Boolean requiresAttachment;
    private Boolean status;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    public void validate() {
        if (isBlank(name)) throw new IllegalArgumentException("name is required");
        if (name.length() > 255) throw new IllegalArgumentException("name max 255");
        if (description != null && description.length() > 500) throw new IllegalArgumentException("description max 500");
        if (requiresAttachment == null) requiresAttachment = false;
        if (status == null) status = true;
    }
    public void touchCreated() {
        if (createdAt == null) createdAt = Instant.now();
        if (requiresAttachment == null) requiresAttachment = false;
        if (status == null) status = true;
        if (rowVersion == 0) rowVersion = 1L;
    }
    public void touchUpdated() {
        updatedAt = Instant.now();
        // row_version is owned by JPA @Version (reinforced by fn_audit_timestamps trigger);
        // pre-incrementing it here makes merge() fail with StaleObjectStateException
    }
    private static boolean isBlank(String s){ return s==null || s.trim().isEmpty(); }
    @Override public boolean equals(Object o){ if(this==o) return true; if(!(o instanceof JustificationType)) return false; JustificationType that=(JustificationType)o; return Objects.equals(justificationTypeId, that.justificationTypeId); }
    @Override public int hashCode(){ return Objects.hash(justificationTypeId); }
}
