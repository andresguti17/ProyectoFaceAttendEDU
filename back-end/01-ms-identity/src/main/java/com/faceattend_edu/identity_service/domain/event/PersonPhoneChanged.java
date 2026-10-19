package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record PersonPhoneChanged(
        UUID personId,
        String oldPhone,
        String newPhone,
        Instant occurredAt
) {
}
