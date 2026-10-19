package com.faceattend_edu.scheduling_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "schedule_block", schema = "scheduling",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_block_environment_slot", columnNames = {"environment_id", "day_of_week", "starts_at"}),
                @UniqueConstraint(name = "uq_block_instructor_slot", columnNames = {"instructor_actor_id", "day_of_week", "starts_at"})
        },
        indexes = {
                @Index(name = "idx_block_cohort", columnList = "cohort_id"),
                @Index(name = "idx_block_course", columnList = "course_id")
        })
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class ScheduleBlockJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "schedule_block_id")
    private Long scheduleBlockId;

    @Column(name = "cohort_id", nullable = false)
    private Long cohortId;

    @Column(name = "course_id", nullable = false)
    private Integer courseId;

    @Column(name = "environment_id", nullable = false)
    private Integer environmentId;

    @Column(name = "instructor_actor_id", nullable = false)
    private Long instructorActorId;

    @Column(name = "day_of_week", nullable = false)
    private Short dayOfWeek;

    @Column(name = "starts_at", nullable = false)
    private LocalTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalTime endsAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;
}
