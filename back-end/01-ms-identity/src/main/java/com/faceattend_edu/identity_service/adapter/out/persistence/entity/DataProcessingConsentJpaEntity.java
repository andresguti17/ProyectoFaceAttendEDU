package com.faceattend_edu.identity_service.adapter.out.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "data_processing_consent", schema = "identity")
@Getter
@Setter
@NoArgsConstructor
public class DataProcessingConsentJpaEntity {

    @Id
    @Column(name = "consent_id")
    private UUID consentId;

    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Column(name = "policy_version", nullable = false, length = 20)
    private String policyVersion;

    @Column(name = "accepted_at", nullable = false)
    private LocalDateTime acceptedAt;

    @Column(name = "biometric_accepted", nullable = false)
    private Boolean biometricAccepted = false;

    @Column(name = "biometric_revoked_at")
    private LocalDateTime biometricRevokedAt;

    @Column(name = "channel", nullable = false, length = 10)
    private String channel;

    @Column(name = "recorded_by")
    private UUID recordedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;
}
