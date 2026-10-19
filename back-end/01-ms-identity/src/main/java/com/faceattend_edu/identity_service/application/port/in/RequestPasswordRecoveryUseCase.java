package com.faceattend_edu.identity_service.application.port.in;

/**
 * Paso 1 del flujo de recuperación: pide un código de verificación por correo.
 */
public interface RequestPasswordRecoveryUseCase {

    /**
     * Genera y envía un código de 6 dígitos al correo indicado.
     *
     * <p>Siempre termina en silencio (sin error) cuando la cuenta no existe:
     * la respuesta no puede revelar si hay una cuenta asociada al correo.</p>
     *
     * @param email correo del usuario (formato válido obligatorio)
     */
    void requestCode(String email);
}
