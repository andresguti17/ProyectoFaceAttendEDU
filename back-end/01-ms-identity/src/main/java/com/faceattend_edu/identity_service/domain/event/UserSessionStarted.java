package com.faceattend_edu.identity_service.domain.event;

import java.time.Instant;
import java.util.UUID;

public record UserSessionStarted(
        UUID sessionId,
        UUID userId,
        Instant startedAt,
        String ip
) {
}
