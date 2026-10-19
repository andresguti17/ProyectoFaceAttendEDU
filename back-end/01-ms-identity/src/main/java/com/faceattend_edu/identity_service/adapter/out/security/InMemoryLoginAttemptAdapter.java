package com.faceattend_edu.identity_service.adapter.out.security;

import com.faceattend_edu.identity_service.application.port.out.LoginAttemptPort;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Per-process login attempt counters. Default store; see {@link RedisLoginAttemptAdapter}. */
@Component
@ConditionalOnProperty(name = "faceattend.recovery.store", havingValue = "memory", matchIfMissing = true)
public class InMemoryLoginAttemptAdapter implements LoginAttemptPort {

    private static final class State {
        private int failures;
        private long lockedUntilMillis;
    }

    private final Map<String, State> states = new ConcurrentHashMap<>();

    @Override
    public Duration lockRemaining(String identifier) {
        State state = states.get(key(identifier));
        if (state == null) return Duration.ZERO;
        synchronized (state) {
            long left = state.lockedUntilMillis - System.currentTimeMillis();
            return left > 0 ? Duration.ofMillis(left) : Duration.ZERO;
        }
    }

    @Override
    public boolean recordFailure(String identifier, int maxAttempts, Duration lockDuration) {
        State state = states.computeIfAbsent(key(identifier), k -> new State());
        synchronized (state) {
            // An expired lock starts a fresh count.
            if (state.lockedUntilMillis != 0 && state.lockedUntilMillis <= System.currentTimeMillis()) {
                state.failures = 0;
                state.lockedUntilMillis = 0;
            }
            state.failures++;
            if (state.failures >= maxAttempts && state.lockedUntilMillis == 0) {
                state.lockedUntilMillis = System.currentTimeMillis() + lockDuration.toMillis();
                return true;
            }
            return false;
        }
    }

    @Override
    public void reset(String identifier) {
        states.remove(key(identifier));
    }

    private static String key(String identifier) {
        return identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT);
    }
}
