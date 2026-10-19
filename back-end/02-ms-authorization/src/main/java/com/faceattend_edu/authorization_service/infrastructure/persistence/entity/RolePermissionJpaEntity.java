package com.faceattend_edu.authorization_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "role_permission", schema = "authorization")
@IdClass(RolePermissionId.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class RolePermissionJpaEntity {
    @Id
    @Column(name = "role_id")
    private Integer roleId;

    @Id
    @Column(name = "permission_id")
    private Integer permissionId;

    @Column(name = "assignment_date", nullable = false)
    private Instant assignmentDate;

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

    @Column(name = "row_version", nullable = false)
    private long rowVersion;
}
