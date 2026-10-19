package com.faceattend_edu.identity_service.adapter.out.security;

import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Almacén en memoria de los retos de recuperación (ver {@link RecoveryCodePort}
 * para el porqué de esta decisión).
 *
 * <p>Reglas aplicadas, alineadas con las constantes del front
 * (CODE_LENGTH=6, CODE_EXPIRATION_MS=600000, RESEND_COOLDOWN_MS=60000,
 * MAX_CODE_ATTEMPTS=5):</p>
 * <ul>
 *   <li>solo se guarda el hash SHA-256 del código, nunca el código en claro;</li>
 *   <li>caducan a los {code-ttl-minutes} y se purgan en cada acceso;</li>
 *   <li>como máximo {max-attempts} intentos y luego el reto se destruye;</li>
 *   <li>un reenvío solo se emite tras {resend-cooldown-seconds};</li>
 *   <li>la comparación es en tiempo constante (MessageDigest.isEqual).</li>
 * </ul>
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "faceattend.recovery.store", havingValue = "memory", matchIfMissing = true)
public class InMemoryRecoveryCodeAdapter implements RecoveryCodePort {

    private static final int CODE_LENGTH = 6;

    private final AuthProperties authProperties;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Challenge> challenges = new ConcurrentHashMap<>();

    public InMemoryRecoveryCodeAdapter(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    @Override
    public IssuedCode issue(String email, Duration ttl) {
        String key = key(email);
        if (key.isEmpty()) return null;

        LocalDateTime now = LocalDateTime.now();
        purge(now);

        Challenge current = challenges.get(key);
        if (current != null && current.issuedAt.isAfter(now.minus(authProperties.resendCooldown()))) {
            log.debug("Recovery code resend blocked by cooldown");
            return null;
        }

        String code = generateCode();
        Challenge challenge = new Challenge(hash(code), now, now.plus(ttl));
        challenges.put(key, challenge);
        return new IssuedCode(key, code, challenge.expiresAt);
    }

    @Override
    public boolean verify(String email, String code) {
        String key = key(email);
        if (key.isEmpty()) return false;

        LocalDateTime now = LocalDateTime.now();
        purge(now);

        Challenge challenge = challenges.get(key);
        if (challenge == null) return false;

        if (challenge.expiresAt.isBefore(now) || challenge.attempts >= authProperties.getMaxAttempts()) {
            challenges.remove(key, challenge);
            return false;
        }

        if (!MessageDigest.isEqual(challenge.codeHash, hash(code == null ? "" : code))) {
            challenge.attempts++;
            if (challenge.attempts >= authProperties.getMaxAttempts()) {
                challenges.remove(key, challenge);
                log.info("Recovery code invalidated after {} attempts", challenge.attempts);
            }
            return false;
        }

        challenge.verified = true;
        challenge.attempts = 0;
        return true;
    }

    @Override
    public boolean consumeVerified(String email) {
        String key = key(email);
        if (key.isEmpty()) return false;

        Challenge challenge = challenges.get(key);
        if (challenge == null) return false;
        if (!challenge.verified || challenge.expiresAt.isBefore(LocalDateTime.now())) {
            // No se destruye: un reset sin verificar no debe poder borrar el
            // reto verificado de quien sí pasó por /verify-code.
            return false;
        }
        challenges.remove(key, challenge);
        return true;
    }

    /** Visibilidad para tests: nº de retos vivos. */
    int size() {
        purge(LocalDateTime.now());
        return challenges.size();
    }

    private void purge(LocalDateTime now) {
        challenges.entrySet().removeIf(entry -> entry.getValue().expiresAt.isBefore(now));
    }

    private String generateCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(random.nextInt(10));
        }
        return code.toString();
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static byte[] hash(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static final class Challenge {
        private final byte[] codeHash;
        private final LocalDateTime issuedAt;
        private final LocalDateTime expiresAt;
        private volatile int attempts;
        private volatile boolean verified;

        private Challenge(byte[] codeHash, LocalDateTime issuedAt, LocalDateTime expiresAt) {
            this.codeHash = codeHash;
            this.issuedAt = issuedAt;
            this.expiresAt = expiresAt;
        }
    }
}
