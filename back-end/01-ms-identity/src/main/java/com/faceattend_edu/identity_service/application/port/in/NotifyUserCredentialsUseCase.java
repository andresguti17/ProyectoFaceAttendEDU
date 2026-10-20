package com.faceattend_edu.identity_service.application.port.in;

import java.util.UUID;

/** Emails the initial credentials of a freshly created account and marks it for a forced password change. */
public interface NotifyUserCredentialsUseCase {

    enum Status {
        /** The email was accepted; the account must change its password on first login. */
        SENT,
        /** Nothing was sent: the person has no email or the account is inactive. */
        SKIPPED,
        /** Delivery failed or the email channel is not configured. */
        FAILED
    }

    Status notifyCredentials(UUID userId, String rawPassword);
}
