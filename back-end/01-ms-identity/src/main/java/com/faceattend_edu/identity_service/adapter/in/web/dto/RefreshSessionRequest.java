package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

/**
 * Renovación de sesión: el cliente devuelve el sessionId que todavía tiene
 * (el mismo que usa como Bearer) y recibe uno nuevo.
 */
@Data
public class RefreshSessionRequest {

    @NotNull(message = "sessionId is required")
    private UUID sessionId;
}
