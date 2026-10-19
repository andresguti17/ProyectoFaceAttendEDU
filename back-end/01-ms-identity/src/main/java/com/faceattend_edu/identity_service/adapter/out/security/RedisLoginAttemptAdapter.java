package com.faceattend_edu.identity_service.adapter.out.security;

import com.faceattend_edu.identity_service.application.port.out.LoginAttemptPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

/**
 * Login attempt counters in Redis, active with {@code faceattend.recovery.store=redis}.
 *
 * <p>{@code identity:login-fail:{id}} counts failures (INCR is atomic, and its TTL
 * is the lock duration, so a quiet period resets it); {@code identity:login-lock:{id}}
 * exists only while the identifier is locked, and its TTL is the time left.</p>
 */
@Component
@ConditionalOnProperty(name = "faceattend.recovery.store", havingValue = "redis")
public class RedisLoginAttemptAdapter implements LoginAttemptPort {

    private static final String FAILURES = "identity:login-fail:";
    private static final String LOCK = "identity:login-lock:";

    private final StringRedisTemplate redis;

    public RedisLoginAttemptAdapter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public Duration lockRemaining(String identifier) {
        Long millis = redis.getExpire(LOCK + key(identifier), TimeUnit.MILLISECONDS);
        return millis != null && millis > 0 ? Duration.ofMillis(millis) : Duration.ZERO;
    }

    @Override
    public boolean recordFailure(String identifier, int maxAttempts, Duration lockDuration) {
        String key = key(identifier);
        Long failures = redis.opsForValue().increment(FAILURES + key);
        if (failures == null) return false;
        if (failures == 1L) redis.expire(FAILURES + key, lockDuration);
        if (failures >= maxAttempts) {
            // setIfAbsent: only the request that creates the lock reports it.
            Boolean created = redis.opsForValue().setIfAbsent(LOCK + key, "1", lockDuration);
            redis.delete(FAILURES + key);
            return Boolean.TRUE.equals(created);
        }
        return false;
    }

    @Override
    public void reset(String identifier) {
        redis.delete(FAILURES + key(identifier));
    }

    private static String key(String identifier) {
        return identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT);
    }
}
