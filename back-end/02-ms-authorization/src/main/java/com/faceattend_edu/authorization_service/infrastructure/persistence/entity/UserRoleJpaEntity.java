package com.faceattend_edu.authorization_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_role", schema = "authorization")
@IdClass(UserRoleId.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserRoleJpaEntity {
    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Id
    @Column(name = "role_id")
    private Integer roleId;

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
