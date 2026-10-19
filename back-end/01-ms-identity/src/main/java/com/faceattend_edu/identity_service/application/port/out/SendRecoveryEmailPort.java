package com.faceattend_edu.identity_service.application.port.out;

import java.time.Duration;

/**
 * Salida hacia el canal de correo. La implementación delega en
 * 08-ms-notification (SMTP + templates), que es quien posee el transporte.
 */
public interface SendRecoveryEmailPort {

    /**
     * @param to   destinatario
     * @param code código de 6 dígitos en claro
     * @param ttl  vigencia que se informa en el correo
     * @return {@code true} si notification aceptó el mensaje; {@code false} si
     *         falló la entrega o el canal está sin configurar
     */
    boolean sendRecoveryCode(String to, String code, Duration ttl);
}
