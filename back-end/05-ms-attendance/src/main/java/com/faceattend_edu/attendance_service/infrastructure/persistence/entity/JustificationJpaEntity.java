package com.faceattend_edu.attendance_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "justification", schema = "attendance",
        uniqueConstraints = @UniqueConstraint(name = "uq_justification_attendance_record", columnNames = {"attendance_record_id"}),
        indexes = {
                @Index(name = "idx_justification_type", columnList = "justification_type_id"),
                @Index(name = "idx_justification_reviewer", columnList = "reviewed_by")
        })
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class JustificationJpaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "justification_id")
    private Long justificationId;

    @Column(name = "attendance_record_id", nullable = false, unique = true)
    private Long attendanceRecordId;

    @Column(name = "justification_type_id", nullable = false)
    private Integer justificationTypeId;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "reviewed_by")
    private UUID reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "review_status", nullable = false)
    private String reviewStatus;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

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
    @Version @Column(name = "row_version", nullable = false)
    private long rowVersion;
}
