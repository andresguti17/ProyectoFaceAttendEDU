package com.faceattend_edu.identity_service.application.port.in;

import java.util.UUID;

/**
 * Cambio de contraseña con sesión activa (perfil): exige la contraseña actual,
 * valida la nueva contra la política y cierra las demás sesiones del usuario.
 */
public interface ChangePasswordUseCase {

    /**
     * @param userId           usuario autenticado (de la sesión, nunca del cuerpo)
     * @param currentSessionId sesión desde la que se cambia; queda abierta
     * @throws com.faceattend_edu.identity_service.domain.exception.ValidationException
     *         si la contraseña actual no coincide o la nueva incumple la política (400)
     */
    void changePassword(UUID userId, UUID currentSessionId, String currentPassword, String newPassword);
}
