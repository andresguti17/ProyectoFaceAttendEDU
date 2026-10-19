package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserActivated(
        UUID userId,
        Boolean status,
        Instant occurredAt
) {
}
