package com.faceattend_edu.identity_service.domain.event;

import java.util.UUID;

public record PersonCreated(
        UUID personId,
        String firstName,
        String lastName,
        String email,
        String phone,
        String bloodType
) {
}
