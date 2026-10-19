package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record AuthenticationTypeChanged(
        UUID userId,
        String oldType,
        String newType,
        Instant occurredAt
) {
}
