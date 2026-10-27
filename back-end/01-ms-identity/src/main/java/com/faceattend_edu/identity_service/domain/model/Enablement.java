package com.faceattend_edu.identity_service.domain.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Whether a person may use the features that need accepted terms and facial verification.
 * An adult needs the terms accepted; a minor additionally needs a registered guardian, and
 * the terms must have been accepted for that guardian by a school administrator.
 */
public record Enablement(UUID personId, boolean minor, boolean guardianRegistered, boolean termsAccepted,
                         boolean termsUpToDate, String acceptedVersion, LocalDateTime acceptedAt,
                         String currentTermsVersion, Status status) {

    public enum Status { ENABLED, TERMS_PENDING, GUARDIAN_PENDING }

    public boolean enabled() {
        return status == Status.ENABLED;
    }
}
