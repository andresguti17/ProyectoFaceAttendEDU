package com.faceattend_edu.scheduling_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "environment", schema = "scheduling",
        uniqueConstraints = @UniqueConstraint(name = "uq_environment_code_school", columnNames = {"school_id", "code"}))
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class EnvironmentJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "environment_id")
    private Integer environmentId;

    @Column(name = "school_id", nullable = false)
    private Integer schoolId;

    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "capacity", nullable = false)
    private Short capacity;

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

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;
}
