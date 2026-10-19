package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record PersonEmailChanged(
        UUID personId,
        String oldEmail,
        String newEmail,
        Instant occurredAt
) {
}
