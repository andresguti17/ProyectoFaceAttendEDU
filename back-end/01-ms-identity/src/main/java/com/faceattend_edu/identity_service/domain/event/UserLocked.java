package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserLocked(
        UUID userId,
        String reason,
        Instant occurredAt
) {
}
