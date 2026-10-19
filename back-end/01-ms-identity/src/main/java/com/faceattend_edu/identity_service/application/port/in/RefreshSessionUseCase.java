package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.UserSession;

import java.util.UUID;

/**
 * Renovación de la sesión opaca (refresh token).
 *
 * <p>El sessionId que el cliente ya tiene actúa a la vez como access y como
 * refresh token: al renovar se emite un sessionId NUEVO y el anterior queda
 * cerrado de forma atómica (rotación de un solo uso). Así un token robado deja
 * de servir en cuanto el usuario real lo renueva, y la ventana de vigencia se
 * reinicia en cada renovación.</p>
 */
public interface RefreshSessionUseCase {

    /**
     * @param sessionId sesión vigente que pide la renovación
     * @param sourceIp  IP del cliente (se registra en la sesión nueva)
     * @return la sesión nueva (otro UUID)
     * @throws com.faceattend_edu.identity_service.domain.exception.UnauthorizedException
     *         si la sesión no existe, ya fue cerrada/renovada o expiró
     */
    UserSession refresh(UUID sessionId, String sourceIp);
}
