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
@Table(name = "terms_acceptance", schema = "identity")
@Getter
@Setter
@NoArgsConstructor
public class TermsAcceptanceJpaEntity {

    @Id
    @Column(name = "acceptance_id")
    private UUID acceptanceId;

    @Column(name = "person_id", nullable = false)
    private UUID personId;

    @Column(name = "terms_version", nullable = false, length = 20)
    private String termsVersion;

    @Column(name = "user_type", nullable = false, length = 10)
    private String userType;

    @Column(name = "accepted_by", nullable = false, length = 10)
    private String acceptedBy;

    @Column(name = "guardian_id")
    private UUID guardianId;

    @Column(name = "channel", nullable = false, length = 10)
    private String channel;

    @Column(name = "recorded_by")
    private UUID recordedBy;

    @Column(name = "school_id")
    private Long schoolId;

    @Column(name = "accepted_at", nullable = false)
    private LocalDateTime acceptedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "row_version", nullable = false)
    private Long rowVersion;
}
