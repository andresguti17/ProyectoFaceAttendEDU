package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserDeactivated(
        UUID userId,
        Boolean status,
        Instant occurredAt
) {
}
