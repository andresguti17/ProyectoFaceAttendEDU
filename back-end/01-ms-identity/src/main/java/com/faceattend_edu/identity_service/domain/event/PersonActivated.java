package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record PersonActivated(
        UUID personId,
        Boolean status,
        Instant occurredAt
) {
}
