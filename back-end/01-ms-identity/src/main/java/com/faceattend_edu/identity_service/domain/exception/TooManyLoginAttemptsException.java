package com.faceattend_edu.identity_service.domain.exception;

import java.time.Duration;

/** Too many failed logins from one client IP: retry after {@link #getRetryAfter()} (HTTP 429). */
public class TooManyLoginAttemptsException extends DomainException {
    private static final long serialVersionUID = 1L;

    private final Duration retryAfter;

    public TooManyLoginAttemptsException(Duration retryAfter) {
        super("Too many failed sign-in attempts from this address. Try again later");
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
