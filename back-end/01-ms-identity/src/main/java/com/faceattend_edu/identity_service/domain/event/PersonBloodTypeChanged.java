package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record PersonBloodTypeChanged(
        UUID personId,
        String oldBloodType,
        String newBloodType,
        Instant occurredAt
) {
}
