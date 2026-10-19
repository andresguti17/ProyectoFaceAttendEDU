package com.faceattend_edu.identity_service.application.port.in;

/**
 * Paso 3 del flujo de recuperación: cambia la contraseña tras verificar el código.
 */
public interface ResetPasswordUseCase {

    /**
     * Aplica la nueva contraseña, consume el reto verificado y cierra todas
     * las sesiones abiertas del usuario (el cambio de credencial invalida lo
     * que esté vivo).
     *
     * @param email       correo del usuario
     * @param rawPassword contraseña nueva en claro (se valida contra la política)
     * @throws com.faceattend_edu.identity_service.domain.exception.UnauthorizedException
     *         si no hay un reto verificado y vigente para ese correo (401)
     * @throws com.faceattend_edu.identity_service.domain.exception.ValidationException
     *         si la contraseña no cumple la política vigente (400)
     */
    void resetPassword(String email, String rawPassword);
}
