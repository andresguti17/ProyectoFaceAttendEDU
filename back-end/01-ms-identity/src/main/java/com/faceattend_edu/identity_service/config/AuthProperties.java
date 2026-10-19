package com.faceattend_edu.identity_service.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Ajustes de autenticación de este microservicio: vigencia de la sesión opaca,
 * parámetros del flujo de recuperación de contraseña y el cliente HTTP hacia
 * notification (canal de correo SMTP).
 *
 * <p>Todos tienen valor por defecto para que el servicio arranque sin .env; en
 * Docker se sobrescriben con las variables FACEATTEND_AUTH_* /
 * FACEATTEND_RECOVERY_* / FACEATTEND_NOTIFICATION_* (compose).</p>
 *
 * <p>El seed de {@code configuration.security_configuration} define
 * {@code session_timeout_minutes=480}: el valor por defecto de aquí es el mismo
 * para que ambos lados hablen del mismo número.</p>
 */
@Getter
@Setter
@Component
public class AuthProperties {

    /** Vigencia de la sesión: start_date + esto = expiración. */
    @Value("${faceattend.auth.session-timeout-minutes:480}")
    private long sessionTimeoutMinutes = 480;

    /** Vida del código de verificación de recuperación. */
    @Value("${faceattend.recovery.code-ttl-minutes:10}")
    private long codeTtlMinutes = 10;

    /** Intentos fallidos antes de invalidar el código. */
    @Value("${faceattend.recovery.max-attempts:5}")
    private int maxAttempts = 5;

    /** Espera mínima entre envíos del mismo código. */
    @Value("${faceattend.recovery.resend-cooldown-seconds:60}")
    private long resendCooldownSeconds = 60;

    /** Failed logins before the identifier is locked (mirrors security_configuration max_login_attempts). */
    @Value("${faceattend.auth.max-login-attempts:5}")
    private int maxLoginAttempts = 5;

    /** Lock length in minutes (mirrors security_configuration lockout_duration_minutes). */
    @Value("${faceattend.auth.lockout-minutes:30}")
    private long lockoutMinutes = 30;

    /** URL interna de notification (red compose: http://ms-notification:8088). */
    @Value("${faceattend.notification.base-url:http://localhost:8088}")
    private String notificationBaseUrl = "http://localhost:8088";

    /** Secreto compartido opcional con notification (header X-Internal-Token). */
    @Value("${faceattend.notification.internal-token:}")
    private String notificationInternalToken = "";

    public Duration sessionTimeout() {
        return Duration.ofMinutes(sessionTimeoutMinutes);
    }

    public Duration lockoutDuration() {
        return Duration.ofMinutes(lockoutMinutes);
    }

    public Duration codeTtl() {
        return Duration.ofMinutes(codeTtlMinutes);
    }

    public Duration resendCooldown() {
        return Duration.ofSeconds(resendCooldownSeconds);
    }
}
