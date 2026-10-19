package com.faceattend_edu.scheduling_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ClassSession {
    private Long classSessionId;
    private Long scheduleBlockId;
    private LocalDate sessionDate;
    private String sessionStatus;
    private Long openedBy;
    private Instant openedAt;
    private Long closedBy;
    private Instant closedAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    private static final Set<String> ALLOWED_STATUSES = Set.of("Open", "Closed", "Cancelled");

    public void validate() {
        if (scheduleBlockId == null) throw new IllegalArgumentException("scheduleBlockId is required");
        if (sessionDate == null) throw new IllegalArgumentException("sessionDate is required");
        if (sessionStatus == null || sessionStatus.isBlank()) throw new IllegalArgumentException("sessionStatus is required");
        if (!ALLOWED_STATUSES.contains(sessionStatus)) throw new IllegalArgumentException("sessionStatus must be one of " + ALLOWED_STATUSES);
    }

    public void touchCreated() {
        if (createdAt == null) createdAt = Instant.now();
        if (sessionStatus == null) sessionStatus = "Open";
        if (rowVersion == 0) rowVersion = 1L;
    }

    public void touchUpdated() {
        updatedAt = Instant.now();
        // row_version is owned by JPA @Version (reinforced by fn_audit_timestamps trigger);
        // pre-incrementing it here makes merge() fail with StaleObjectStateException
    }

    public boolean isOpen() { return "Open".equals(sessionStatus); }
    public boolean isClosed() { return "Closed".equals(sessionStatus); }
    public boolean isCancelled() { return "Cancelled".equals(sessionStatus); }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ClassSession)) return false;
        ClassSession that = (ClassSession) o;
        return Objects.equals(classSessionId, that.classSessionId);
    }
    @Override public int hashCode() { return Objects.hash(classSessionId); }
}
