package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserSessionClosed(
        UUID sessionId,
        UUID userId,
        Instant occurredAt
) {
}
