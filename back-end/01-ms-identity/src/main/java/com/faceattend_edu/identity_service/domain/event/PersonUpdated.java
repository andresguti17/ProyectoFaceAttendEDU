package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record PersonUpdated(
        UUID personId,
        String firstName,
        String lastName,
        String email,
        String phone,
        String bloodType,
        Instant occurredAt
) {
}
