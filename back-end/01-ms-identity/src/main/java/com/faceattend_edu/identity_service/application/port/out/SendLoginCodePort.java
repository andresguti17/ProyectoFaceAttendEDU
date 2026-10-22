package com.faceattend_edu.identity_service.application.port.out;

import java.time.Duration;

/** Outbound e-mail of the second-factor code (delivered through 08-ms-notification). */
public interface SendLoginCodePort {

    /**
     * @return {@code true} if notification accepted the message; {@code false} if delivery failed
     *         or the e-mail channel is not configured
     */
    boolean sendLoginCode(String to, String recipientName, String code, Duration ttl);
}
