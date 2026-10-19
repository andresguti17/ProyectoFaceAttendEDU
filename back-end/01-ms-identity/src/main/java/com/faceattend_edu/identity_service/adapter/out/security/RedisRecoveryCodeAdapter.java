package com.faceattend_edu.identity_service.adapter.out.security;

import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;

/**
 * Almacén de los retos de recuperación en Redis: sobrevive a reinicios y se
 * comparte entre réplicas de identity. Se activa con
 * {@code faceattend.recovery.store=redis}; por defecto sigue el almacén en memoria.
 *
 * <p>Mismas reglas que {@link InMemoryRecoveryCodeAdapter}: solo se guarda el
 * hash SHA-256 del código, caduca por TTL de la clave, máximo de intentos,
 * cooldown de reenvío y comparación en tiempo constante. Cada reto es un hash
 * {@code identity:recovery:{email}}; el contador de intentos usa HINCRBY y el
 * consumo único se decide por el resultado de DEL, ambos atómicos.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "faceattend.recovery.store", havingValue = "redis")
public class RedisRecoveryCodeAdapter implements RecoveryCodePort {

    private static final int CODE_LENGTH = 6;
    private static final String KEY_PREFIX = "identity:recovery:";
    private static final String HASH = "hash";
    private static final String ISSUED_AT = "issuedAt";
    private static final String ATTEMPTS = "attempts";
    private static final String VERIFIED = "verified";

    private final StringRedisTemplate redis;
    private final AuthProperties authProperties;
    private final SecureRandom random = new SecureRandom();

    public RedisRecoveryCodeAdapter(StringRedisTemplate redis, AuthProperties authProperties) {
        this.redis = redis;
        this.authProperties = authProperties;
    }

    @Override
    public IssuedCode issue(String email, Duration ttl) {
        String normalized = normalize(email);
        if (normalized.isEmpty()) return null;
        String key = KEY_PREFIX + normalized;

        long nowMillis = System.currentTimeMillis();
        Object issuedAt = redis.opsForHash().get(key, ISSUED_AT);
        if (issuedAt != null && Long.parseLong(issuedAt.toString()) > nowMillis - authProperties.resendCooldown().toMillis()) {
            log.debug("Recovery code resend blocked by cooldown");
            return null;
        }

        String code = generateCode();
        redis.delete(key);
        redis.opsForHash().putAll(key, Map.of(
                HASH, hash(code),
                ISSUED_AT, Long.toString(nowMillis),
                ATTEMPTS, "0",
                VERIFIED, "0"));
        redis.expire(key, ttl);
        return new IssuedCode(normalized, code, LocalDateTime.now().plus(ttl));
    }

    @Override
    public boolean verify(String email, String code) {
        String normalized = normalize(email);
        if (normalized.isEmpty()) return false;
        String key = KEY_PREFIX + normalized;

        Object stored = redis.opsForHash().get(key, HASH);
        if (stored == null) return false;

        Object attempts = redis.opsForHash().get(key, ATTEMPTS);
        if (attempts != null && Long.parseLong(attempts.toString()) >= authProperties.getMaxAttempts()) {
            redis.delete(key);
            return false;
        }

        byte[] expected = stored.toString().getBytes(StandardCharsets.UTF_8);
        byte[] actual = hash(code == null ? "" : code).getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, actual)) {
            Long used = redis.opsForHash().increment(key, ATTEMPTS, 1);
            if (used != null && used >= authProperties.getMaxAttempts()) {
                redis.delete(key);
                log.info("Recovery code invalidated after {} attempts", used);
            }
            return false;
        }

        redis.opsForHash().put(key, VERIFIED, "1");
        redis.opsForHash().put(key, ATTEMPTS, "0");
        return true;
    }

    @Override
    public boolean consumeVerified(String email) {
        String normalized = normalize(email);
        if (normalized.isEmpty()) return false;
        String key = KEY_PREFIX + normalized;

        // No se destruye si no está verificado: un reset sin verificar no debe
        // poder borrar el reto de quien sí pasó por /verify-code.
        if (!"1".equals(redis.opsForHash().get(key, VERIFIED))) return false;
        // DEL es atómico: solo una petición concurrente gana el uso único.
        return Boolean.TRUE.equals(redis.delete(key));
    }

    private String generateCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            code.append(random.nextInt(10));
        }
        return code.toString();
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
