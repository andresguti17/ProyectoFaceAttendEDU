package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserAuthenticated(
        UUID userId,
        String username,
        Instant occurredAt,
        String ip
) {
}
