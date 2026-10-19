package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserAuthenticationFailed(
        UUID userId,
        String username,
        String reason,
        Instant occurredAt
) {
}
