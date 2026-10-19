package com.faceattend_edu.identity_service.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "app_user", schema = "identity")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "user_id")
    private UUID userId;

    @ManyToOne
    @JoinColumn(name = "person_id", nullable = false, unique = true)
    private PersonJpaEntity person;

    @Column(name = "username", nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    // ENUM nativo de Postgres: se escribe como String y el driver lo coerciona (stringtype=unspecified).
    @Column(name = "authentication_type", nullable = false, columnDefinition = "identity.authentication_type")
    private String authenticationType;

    @Column(name = "status", nullable = false)
    private Boolean status;

    @Column(name = "last_access")
    private LocalDateTime lastAccess;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    @Column(name = "row_version", nullable = false, insertable = false, updatable = false)
    private Long rowVersion;
}
