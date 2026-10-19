package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserCreated(
        UUID userId,
        String username,
        String email,
        Boolean active,
        Instant occurredAt
) {
}
