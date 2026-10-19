package com.faceattend_edu.scheduling_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "class_session", schema = "scheduling",
        uniqueConstraints = @UniqueConstraint(name = "uq_session_block_date", columnNames = {"schedule_block_id", "session_date"}),
        indexes = @Index(name = "idx_session_date", columnList = "session_date"))
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class ClassSessionJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "class_session_id")
    private Long classSessionId;

    @Column(name = "schedule_block_id", nullable = false)
    private Long scheduleBlockId;

    @Column(name = "session_date", nullable = false)
    private LocalDate sessionDate;

    @Column(name = "opened_by")
    private Long openedBy;

    @Column(name = "opened_at")
    private Instant openedAt;

    @Column(name = "closed_by")
    private Long closedBy;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "session_status", nullable = false)
    private String sessionStatus;

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
