package com.faceattend_edu.attendance_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "justification_type", schema = "attendance",
        uniqueConstraints = @UniqueConstraint(name = "uq_justification_type_school_name", columnNames = {"school_id", "name"}),
        indexes = @Index(name = "idx_justification_type_school", columnList = "school_id"))
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class JustificationTypeJpaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "justification_type_id")
    private Integer justificationTypeId;

    @Column(name = "school_id")
    private Integer schoolId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "requires_attachment", nullable = false)
    private Boolean requiresAttachment;

    @Column(name = "status", nullable = false)
    private Boolean status;

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
