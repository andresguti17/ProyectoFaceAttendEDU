package com.faceattend_edu.scheduling_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ScheduleBlock {
    private Long scheduleBlockId;
    private Long cohortId;
    private Integer courseId;
    private Integer environmentId;
    private Long instructorActorId;
    private Short dayOfWeek;
    private LocalTime startsAt;
    private LocalTime endsAt;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    public void validate() {
        if (cohortId == null) throw new IllegalArgumentException("cohortId is required");
        if (courseId == null) throw new IllegalArgumentException("courseId is required");
        if (environmentId == null) throw new IllegalArgumentException("environmentId is required");
        if (instructorActorId == null) throw new IllegalArgumentException("instructorActorId is required");
        if (dayOfWeek == null) throw new IllegalArgumentException("dayOfWeek is required");
        if (dayOfWeek < 1 || dayOfWeek > 7) throw new IllegalArgumentException("dayOfWeek must be between 1 and 7");
        if (startsAt == null) throw new IllegalArgumentException("startsAt is required");
        if (endsAt == null) throw new IllegalArgumentException("endsAt is required");
        if (!startsAt.isBefore(endsAt)) throw new IllegalArgumentException("startsAt must be before endsAt");
    }

    public void touchCreated() {
        if (createdAt == null) createdAt = Instant.now();
        if (rowVersion == 0) rowVersion = 1L;
    }

    public void touchUpdated() {
        updatedAt = Instant.now();
        // row_version is owned by JPA @Version (reinforced by fn_audit_timestamps trigger);
        // pre-incrementing it here makes merge() fail with StaleObjectStateException
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ScheduleBlock)) return false;
        ScheduleBlock that = (ScheduleBlock) o;
        return Objects.equals(scheduleBlockId, that.scheduleBlockId);
    }
    @Override public int hashCode() { return Objects.hash(scheduleBlockId); }
}
