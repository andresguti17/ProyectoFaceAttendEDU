package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UsernameChanged(
        UUID userId,
        String oldUsername,
        String newUsername,
        Instant occurredAt
) {
}
