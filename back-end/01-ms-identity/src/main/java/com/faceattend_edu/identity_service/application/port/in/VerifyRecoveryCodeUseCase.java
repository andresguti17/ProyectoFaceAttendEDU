package com.faceattend_edu.identity_service.application.port.in;

/**
 * Paso 2 del flujo de recuperación: valida el código recibido por correo y
 * deja el reto en estado "verificado" para poder cambiar la contraseña.
 */
public interface VerifyRecoveryCodeUseCase {

    /**
     * @param email correo del usuario
     * @param code  código de 6 dígitos
     * @throws com.faceattend_edu.identity_service.domain.exception.ValidationException
     *         si el formato del correo o del código es inválido
     * @throws com.faceattend_edu.identity_service.domain.exception.UnauthorizedException
     *         si el código es incorrecto, venció o se agotaron los intentos (401)
     */
    void verify(String email, String code);
}
