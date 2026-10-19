package com.faceattend_edu.identity_service.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "password_policy", schema = "identity")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PasswordPolicyJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_id")
    private Integer policyId;

    @Column(name = "min_length", nullable = false)
    private Integer minLength;

    @Column(name = "max_length", nullable = false)
    private Integer maxLength;

    @Column(name = "requires_uppercase", nullable = false)
    private Boolean requiresUppercase;

    @Column(name = "requires_numbers", nullable = false)
    private Boolean requiresNumbers;

    @Column(name = "requires_symbols", nullable = false)
    private Boolean requiresSymbols;

    @Column(name = "expiration_days", nullable = false)
    private Integer expirationDays;

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
