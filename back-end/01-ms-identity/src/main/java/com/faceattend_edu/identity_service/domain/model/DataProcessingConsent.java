package com.faceattend_edu.identity_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Authorization to process personal data (Ley 1581 de 2012). The biometric part is a
 * separate, optional flag because the law makes authorizing sensitive data optional (art. 6-a).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class DataProcessingConsent {

    public static final String SELF = "self";
    public static final String ASSISTED = "assisted";

    private UUID consentId;
    private UUID personId;
    private String policyVersion;
    private LocalDateTime acceptedAt;
    private boolean biometricAccepted;
    private LocalDateTime biometricRevokedAt;
    private String channel;
    private UUID recordedBy;

    /** Biometric data may be processed: accepted and not revoked. */
    public boolean biometricAuthorized() {
        return biometricAccepted && biometricRevokedAt == null;
    }
}
