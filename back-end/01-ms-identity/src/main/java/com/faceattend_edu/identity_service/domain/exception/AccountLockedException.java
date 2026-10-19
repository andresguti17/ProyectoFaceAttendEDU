package com.faceattend_edu.identity_service.domain.exception;

import java.time.Duration;

/** Too many failed logins: the identifier is locked until {@link #getRetryAfter()} elapses. */
public class AccountLockedException extends DomainException {
    private static final long serialVersionUID = 1L;

    private final Duration retryAfter;

    public AccountLockedException(Duration retryAfter) {
        super("Account temporarily locked after too many failed attempts");
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
