package com.faceattend_edu.identity_service.application.port.out;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Almacén de los códigos de recuperación de contraseña.
 *
 * <p>Decisión de diseño (revisada con el equipo): se guarda en memoria de este
 * proceso con TTL, sin tabla nueva en el modelo relacional. Consecuencias: los
 * códigos vivos se pierden al reiniciar identity y el almacén no se comparte
 * entre réplicas. Si el servicio escala o se necesita auditoría de códigos,
 * esta interfaz es el único punto a cambiar (Redis o una tabla en identity).</p>
 */
public interface RecoveryCodePort {

    /** Código emitido: el valor en claro solo viaja hacia el canal de correo. */
    record IssuedCode(String email, String code, LocalDateTime expiresAt) {
    }

    /**
     * Emite un código nuevo para el correo.
     *
     * @return el código emitido, o {@code null} si aún no pasó la ventana de
     *         reenvío (cooldown) y no debe emitirse otro
     */
    IssuedCode issue(String email, Duration ttl);

    /**
     * Valida el código contra el reto vigente y lo marca como verificado.
     * Consume intentos y invalida el reto al agotarlos.
     */
    boolean verify(String email, String code);

    /**
     * Gasta el reto verificado (uso único). Devuelve {@code false} si no había
     * reto verificado y vigente, sin tocarlo en ese caso.
     */
    boolean consumeVerified(String email);
}
