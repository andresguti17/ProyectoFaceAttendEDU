package com.faceattend_edu.identity_service.adapter.out.security;

import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort.IssuedCode;
import com.faceattend_edu.identity_service.config.AuthProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The Redis-backed security stores, on a mocked template that behaves like Redis
 * (an in-memory map with TTLs only recorded). Lockout, the attempt limit on recovery
 * codes and their single use must hold across replicas, so they live in Redis.
 */
@DisplayName("Redis login lockout and recovery codes")
@SuppressWarnings("unchecked")
class RedisSecurityAdaptersTest {

    private final Map<String, String> values = new HashMap<>();
    private final Map<String, Map<Object, Object>> hashes = new HashMap<>();
    private final Map<String, Long> ttlMillis = new HashMap<>();
    private StringRedisTemplate redis;

    @BeforeEach
    void fakeRedis() {
        redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        HashOperations<String, Object, Object> hash = mock(HashOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(redis.opsForHash()).thenReturn((HashOperations) hash);

        when(ops.increment(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            long next = Long.parseLong(values.getOrDefault(key, "0")) + 1;
            values.put(key, Long.toString(next));
            return next;
        });
        when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            if (values.containsKey(key)) return false;
            values.put(key, inv.getArgument(1));
            ttlMillis.put(key, ((Duration) inv.getArgument(2)).toMillis());
            return true;
        });
        when(redis.expire(anyString(), any(Duration.class))).thenAnswer(inv -> {
            ttlMillis.put(inv.getArgument(0), ((Duration) inv.getArgument(1)).toMillis());
            return true;
        });
        when(redis.getExpire(anyString(), eq(TimeUnit.MILLISECONDS))).thenAnswer(inv -> ttlMillis.getOrDefault(inv.getArgument(0), -2L));
        when(redis.delete(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            boolean existed = values.remove(key) != null | hashes.remove(key) != null;
            ttlMillis.remove(key);
            return existed;
        });

        when(hash.get(anyString(), any())).thenAnswer(inv -> hashes.getOrDefault(inv.getArgument(0), Map.of()).get(inv.getArgument(1)));
        org.mockito.Mockito.doAnswer(inv -> {
            hashes.computeIfAbsent(inv.getArgument(0), k -> new HashMap<>()).putAll(inv.getArgument(1));
            return null;
        }).when(hash).putAll(anyString(), anyMap());
        org.mockito.Mockito.doAnswer(inv -> {
            hashes.computeIfAbsent(inv.getArgument(0), k -> new HashMap<>()).put(inv.getArgument(1), inv.getArgument(2));
            return null;
        }).when(hash).put(anyString(), any(), any());
        when(hash.increment(anyString(), any(), anyLong())).thenAnswer(inv -> {
            Map<Object, Object> h = hashes.computeIfAbsent(inv.getArgument(0), k -> new HashMap<>());
            long next = Long.parseLong(String.valueOf(h.getOrDefault(inv.getArgument(1), "0"))) + (long) inv.getArgument(2);
            h.put(inv.getArgument(1), Long.toString(next));
            return next;
        });
    }

    @Nested
    class LoginLockout {
        @Test
        void locksOnceAfterTheLastAllowedFailureAndReportsTheRemainingTime() {
            RedisLoginAttemptAdapter attempts = new RedisLoginAttemptAdapter(redis);
            Duration lock = Duration.ofMinutes(30);
            assertThat(attempts.recordFailure(" Ana@Sede.edu ", 3, lock)).isFalse();
            assertThat(ttlMillis).containsEntry("identity:login-fail:ana@sede.edu", lock.toMillis());
            assertThat(attempts.recordFailure("ana@sede.edu", 3, lock)).isFalse();
            assertThat(attempts.lockRemaining("ana@sede.edu")).isEqualTo(Duration.ZERO);
            assertThat(attempts.recordFailure("ANA@sede.edu", 3, lock)).isTrue();
            assertThat(attempts.lockRemaining("ana@sede.edu")).isEqualTo(lock);
            assertThat(values).doesNotContainKey("identity:login-fail:ana@sede.edu");
        }

        @Test
        void aSuccessfulLoginForgetsTheFailures() {
            RedisLoginAttemptAdapter attempts = new RedisLoginAttemptAdapter(redis);
            attempts.recordFailure("ana", 5, Duration.ofMinutes(1));
            attempts.reset("ANA");
            assertThat(values).doesNotContainKey("identity:login-fail:ana");
            assertThat(attempts.lockRemaining(null)).isEqualTo(Duration.ZERO);
        }
    }

    @Nested
    class RecoveryCodes {
        private final AuthProperties properties = new AuthProperties();

        @Test
        void issuesASixDigitCodeStoredOnlyAsAHashAndHonoursTheResendCooldown() {
            RedisRecoveryCodeAdapter codes = new RedisRecoveryCodeAdapter(redis, properties);
            IssuedCode issued = codes.issue(" Ana@Sede.edu ", Duration.ofMinutes(10));
            assertThat(issued.code()).matches("\\d{6}");
            Map<Object, Object> stored = hashes.get("identity:recovery:ana@sede.edu");
            assertThat(stored.get("hash")).isNotEqualTo(issued.code());
            assertThat(String.valueOf(stored.get("hash"))).hasSize(64);
            assertThat(codes.issue("ana@sede.edu", Duration.ofMinutes(10))).isNull();
            assertThat(codes.issue("  ", Duration.ofMinutes(10))).isNull();
        }

        @Test
        void aVerifiedCodeIsUsedOnce() {
            RedisRecoveryCodeAdapter codes = new RedisRecoveryCodeAdapter(redis, properties);
            String code = codes.issue("ana@sede.edu", Duration.ofMinutes(10)).code();
            assertThat(codes.consumeVerified("ana@sede.edu")).isFalse();
            assertThat(codes.verify("ANA@sede.edu", code)).isTrue();
            assertThat(codes.consumeVerified("ana@sede.edu")).isTrue();
            assertThat(codes.consumeVerified("ana@sede.edu")).isFalse();
            assertThat(codes.verify("ana@sede.edu", code)).isFalse();
            assertThat(codes.verify("", code)).isFalse();
            assertThat(codes.consumeVerified(null)).isFalse();
        }

        @Test
        void tooManyWrongCodesDestroyTheChallenge() {
            properties.setMaxAttempts(2);
            RedisRecoveryCodeAdapter codes = new RedisRecoveryCodeAdapter(redis, properties);
            String code = codes.issue("ana@sede.edu", Duration.ofMinutes(10)).code();
            assertThat(codes.verify("ana@sede.edu", "000000".equals(code) ? "111111" : "000000")).isFalse();
            assertThat(codes.verify("ana@sede.edu", null)).isFalse();
            assertThat(hashes).doesNotContainKey("identity:recovery:ana@sede.edu");
            assertThat(codes.verify("ana@sede.edu", code)).isFalse();
        }

        @Test
        void aChallengeAlreadyAtTheLimitIsDestroyedOnTheNextTry() {
            RedisRecoveryCodeAdapter codes = new RedisRecoveryCodeAdapter(redis, properties);
            String code = codes.issue("ana@sede.edu", Duration.ofMinutes(10)).code();
            hashes.get("identity:recovery:ana@sede.edu").put("attempts", "5");
            assertThat(codes.verify("ana@sede.edu", code)).isFalse();
            assertThat(hashes).doesNotContainKey("identity:recovery:ana@sede.edu");
        }
    }
}
