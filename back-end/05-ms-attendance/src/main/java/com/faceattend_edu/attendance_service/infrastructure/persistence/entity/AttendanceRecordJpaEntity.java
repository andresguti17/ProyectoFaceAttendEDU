package com.faceattend_edu.attendance_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "attendance_record", schema = "attendance",
        uniqueConstraints = @UniqueConstraint(name = "uq_attendance_session_actor", columnNames = {"class_session_id", "academic_actor_id"}),
        indexes = {
                @Index(name = "idx_attendance_actor", columnList = "academic_actor_id"),
                @Index(name = "idx_attendance_deleted", columnList = "deleted_at")
        })
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class AttendanceRecordJpaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "attendance_record_id")
    private Long attendanceRecordId;

    @Column(name = "class_session_id", nullable = false)
    private Long classSessionId;

    @Column(name = "academic_actor_id", nullable = false)
    private Long academicActorId;

    @Column(name = "attendance_status", nullable = false)
    private String attendanceStatus;

    @Column(name = "capture_method", nullable = false)
    private String captureMethod;

    @Column(name = "captured_at")
    private Instant capturedAt;

    @Column(name = "match_score", precision = 5, scale = 4)
    private BigDecimal matchScore;

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
