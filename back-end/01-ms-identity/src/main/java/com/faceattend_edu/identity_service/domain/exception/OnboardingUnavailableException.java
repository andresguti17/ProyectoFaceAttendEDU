package com.faceattend_edu.identity_service.domain.exception;

/** The school sign-up cannot run right now (not configured or a downstream service failed). */
public class OnboardingUnavailableException extends DomainException {
    private static final long serialVersionUID = 1L;

    public OnboardingUnavailableException(String message) {
        super(message);
    }

    public OnboardingUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
