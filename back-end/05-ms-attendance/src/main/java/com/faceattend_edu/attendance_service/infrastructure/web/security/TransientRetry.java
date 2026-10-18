package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.springframework.web.client.ResourceAccessException;

import java.util.function.Supplier;

/**
 * One retry, after a short pause, for I/O failures (connect/read timeouts, resets)
 * of the inter-service calls behind the auth filter. Under load a single slow
 * response was enough to answer 503 on an otherwise healthy request. HTTP error
 * statuses are never retried and a second failure still propagates, so callers
 * keep failing secure.
 */
final class TransientRetry {

    private static final long PAUSE_MS = 250;

    private TransientRetry() {}

    static <T> T call(Supplier<T> call) {
        try {
            return call.get();
        } catch (ResourceAccessException first) {
            try {
                Thread.sleep(PAUSE_MS);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw first;
            }
            return call.get();
        }
    }
}
