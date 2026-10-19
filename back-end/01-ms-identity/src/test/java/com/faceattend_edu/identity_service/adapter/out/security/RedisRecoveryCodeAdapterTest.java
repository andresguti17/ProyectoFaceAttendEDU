package com.faceattend_edu.identity_service.adapter.out.security;

import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort.IssuedCode;
import com.faceattend_edu.identity_service.config.AuthProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Same cases as InMemoryRecoveryCodeAdapterTest, against a real Redis.
 * Skipped unless REDIS_TEST_HOST is set (for example REDIS_TEST_HOST=localhost
 * with the compose redis service up), so a plain {@code mvn test} stays offline.
 */
@EnabledIfEnvironmentVariable(named = "REDIS_TEST_HOST", matches = ".+")
class RedisRecoveryCodeAdapterTest {

    private static final String EMAIL = "Carolina.Mendoza@Example.com";
    private static final String KEY = "identity:recovery:carolina.mendoza@example.com";

    private LettuceConnectionFactory factory;
    private StringRedisTemplate redis;
    private RedisRecoveryCodeAdapter adapter;

    @BeforeEach
    void setUp() {
        String host = System.getenv("REDIS_TEST_HOST");
        int port = Integer.parseInt(System.getenv().getOrDefault("REDIS_TEST_PORT", "6379"));
        factory = new LettuceConnectionFactory(new RedisStandaloneConfiguration(host, port));
        factory.afterPropertiesSet();
        redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();
        redis.delete(KEY);
        adapter = new RedisRecoveryCodeAdapter(redis, new AuthProperties());
    }

    @AfterEach
    void tearDown() {
        redis.delete(KEY);
        factory.destroy();
    }

    @Test
    void issuesSixDigitCodeThatVerifies() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));

        assertThat(issued).isNotNull();
        assertThat(issued.code()).matches("\\d{6}");
        assertThat(issued.expiresAt()).isAfter(LocalDateTime.now());
        assertThat(adapter.verify("carolina.mendoza@example.com", issued.code())).isTrue();
    }

    @Test
    void storesOnlyTheHashNeverTheCode() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));

        assertThat(redis.opsForHash().entries(KEY).values()).doesNotContain(issued.code());
    }

    @Test
    void expiresWithTheTtl() {
        adapter.issue(EMAIL, Duration.ofMinutes(10));

        Long seconds = redis.getExpire(KEY);
        assertThat(seconds).isBetween(1L, 600L);
    }

    @Test
    void blocksResendDuringCooldown() {
        assertThat(adapter.issue(EMAIL, Duration.ofMinutes(10))).isNotNull();

        assertThat(adapter.issue(EMAIL, Duration.ofMinutes(10))).isNull();
    }

    @Test
    void destroysTheChallengeAfterTooManyWrongAttempts() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));
        AuthProperties properties = new AuthProperties();

        for (int i = 0; i < properties.getMaxAttempts(); i++) {
            assertThat(adapter.verify(EMAIL, "000000".equals(issued.code()) ? "111111" : "000000")).isFalse();
        }

        assertThat(adapter.verify(EMAIL, issued.code())).isFalse();
    }

    @Test
    void aWrongCodeDoesNotVerify() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));

        assertThat(adapter.verify(EMAIL, "000000".equals(issued.code()) ? "111111" : "000000")).isFalse();
        assertThat(adapter.consumeVerified(EMAIL)).isFalse();
    }

    @Test
    void consumeNeedsAVerifiedChallengeAndWorksOnlyOnce() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));

        assertThat(adapter.consumeVerified(EMAIL)).isFalse();
        assertThat(adapter.verify(EMAIL, issued.code())).isTrue();
        assertThat(adapter.consumeVerified(EMAIL)).isTrue();
        assertThat(adapter.consumeVerified(EMAIL)).isFalse();
    }

    @Test
    void anUnverifiedConsumeDoesNotDestroyTheChallenge() {
        IssuedCode issued = adapter.issue(EMAIL, Duration.ofMinutes(10));

        adapter.consumeVerified(EMAIL);

        assertThat(adapter.verify(EMAIL, issued.code())).isTrue();
    }

    @Test
    void anUnknownEmailNeverVerifies() {
        assertThat(adapter.verify("nobody@example.com", "123456")).isFalse();
        assertThat(adapter.verify(null, "123456")).isFalse();
        assertThat(adapter.issue("  ", Duration.ofMinutes(10))).isNull();
    }
}
