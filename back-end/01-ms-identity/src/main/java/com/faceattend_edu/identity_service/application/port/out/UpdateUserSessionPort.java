package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.UserSession;

import java.time.LocalDateTime;
import java.util.UUID;

public interface UpdateUserSessionPort {
    void updateUserSession(UserSession session);

    /**
     * Cierre condicional de una sola sentencia UPDATE ... WHERE status='Active':
     * devuelve 1 solo al llamador que logró cerrarla, lo que hace de la
     * renovación un intercambio de un solo uso aunque lleguen peticiones
     * concurrentes con el mismo token.
     */
    int closeSessionIfActive(UUID sessionId, LocalDateTime closedAt);
}
