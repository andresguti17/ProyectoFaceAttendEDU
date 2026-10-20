package com.faceattend_edu.identity_service.application.port.out;

/**
 * Salida hacia el canal de correo para entregar las credenciales iniciales de
 * una cuenta nueva. La implementación delega en 08-ms-notification (plantilla
 * {@code user_credentials}); la contraseña viaja solo por la red interna y
 * nunca se registra en logs.
 */
public interface SendCredentialsEmailPort {

    /**
     * @return {@code true} si notification aceptó el mensaje; {@code false} si
     *         falló la entrega o el canal está sin configurar
     */
    boolean sendCredentials(String to, String recipientName, String username, String password);
}
