package com.faceattend_edu.identity_service.adapter.out.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The login lock against a real Redis. Skipped unless REDIS_TEST_HOST is set,
 * so a plain {@code mvn test} stays offline.
 */
@EnabledIfEnvironmentVariable(named = "REDIS_TEST_HOST", matches = ".+")
class RedisLoginAttemptAdapterTest {

    private static final String ID = "Carolina@Example.com";
    private static final Duration LOCK = Duration.ofMinutes(30);

    private LettuceConnectionFactory factory;
    private StringRedisTemplate redis;
    private RedisLoginAttemptAdapter adapter;

    @BeforeEach
    void setUp() {
        String host = System.getenv("REDIS_TEST_HOST");
        int port = Integer.parseInt(System.getenv().getOrDefault("REDIS_TEST_PORT", "6379"));
        factory = new LettuceConnectionFactory(new RedisStandaloneConfiguration(host, port));
        factory.afterPropertiesSet();
        redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();
        clean();
        adapter = new RedisLoginAttemptAdapter(redis);
    }

    @AfterEach
    void tearDown() {
        clean();
        factory.destroy();
    }

    private void clean() {
        redis.delete("identity:login-fail:carolina@example.com");
        redis.delete("identity:login-lock:carolina@example.com");
    }

    @Test
    void lockTriggersAtTheLimitAndReportsItOnlyOnce() {
        for (int i = 0; i < 4; i++) assertThat(adapter.recordFailure(ID, 5, LOCK)).isFalse();

        assertThat(adapter.recordFailure(ID, 5, LOCK)).isTrue();
        assertThat(adapter.lockRemaining(ID)).isBetween(Duration.ofMinutes(29), LOCK);
        assertThat(adapter.recordFailure(ID, 5, LOCK)).isFalse();
    }

    @Test
    void anIdentifierWithoutFailuresIsNotLocked() {
        assertThat(adapter.lockRemaining(ID)).isEqualTo(Duration.ZERO);
    }

    @Test
    void resetClearsTheCounter() {
        for (int i = 0; i < 4; i++) adapter.recordFailure(ID, 5, LOCK);
        adapter.reset(ID);

        assertThat(adapter.recordFailure(ID, 5, LOCK)).isFalse();
    }

    @Test
    void identifiersAreCaseInsensitive() {
        for (int i = 0; i < 4; i++) adapter.recordFailure("CAROLINA@example.COM", 5, LOCK);

        assertThat(adapter.recordFailure(ID, 5, LOCK)).isTrue();
    }

    @Test
    void theCounterExpiresWithTheLockWindow() {
        adapter.recordFailure(ID, 5, Duration.ofMinutes(30));

        Long seconds = redis.getExpire("identity:login-fail:carolina@example.com");
        assertThat(seconds).isBetween(1L, 1800L);
    }
}
