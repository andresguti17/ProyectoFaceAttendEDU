package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record PersonDeactivated(
        UUID personId,
        Boolean status,
        Instant occurredAt
) {
}
