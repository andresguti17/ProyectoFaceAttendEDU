package com.faceattend_edu.attendance_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class Justification {
    private Long justificationId;
    private Long attendanceRecordId;
    private Integer justificationTypeId;
    private String reason;
    private Instant submittedAt;
    private UUID reviewedBy;
    private Instant reviewedAt;
    private String reviewStatus;
    private String resolutionNotes;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    private static final Set<String> ALLOWED = Set.of("Pending","Approved","Rejected");

    public void validate() {
        if (attendanceRecordId == null) throw new IllegalArgumentException("attendanceRecordId is required");
        if (justificationTypeId == null) throw new IllegalArgumentException("justificationTypeId is required");
        if (isBlank(reason)) throw new IllegalArgumentException("reason is required");
        if (reviewStatus != null && !ALLOWED.contains(reviewStatus)) throw new IllegalArgumentException("reviewStatus must be one of " + ALLOWED);
    }
    public void touchCreated() {
        if (createdAt == null) createdAt = Instant.now();
        if (submittedAt == null) submittedAt = Instant.now();
        if (reviewStatus == null) reviewStatus = "Pending";
        if (rowVersion == 0) rowVersion = 1L;
    }
    public void touchUpdated() {
        updatedAt = Instant.now();
        // row_version is owned by JPA @Version (reinforced by fn_audit_timestamps trigger);
        // pre-incrementing it here makes merge() fail with StaleObjectStateException
    }
    private static boolean isBlank(String s){ return s==null || s.trim().isEmpty(); }
    @Override public boolean equals(Object o){ if(this==o) return true; if(!(o instanceof Justification)) return false; Justification that=(Justification)o; return Objects.equals(justificationId, that.justificationId); }
    @Override public int hashCode(){ return Objects.hash(justificationId); }
}
