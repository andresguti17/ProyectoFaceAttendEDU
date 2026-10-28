package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.UserSession;
import java.util.UUID;

public interface LoadUserSessionPort {
    /** Busca por el token que presenta el cliente (bearer). */
    UserSession loadUserSession(UUID sessionId);

    /** Busca por el identificador almacenado (el que listan las rutas de administración), no por el token. */
    default UserSession loadUserSessionByStoredId(UUID storedId) {
        return null;
    }
}
