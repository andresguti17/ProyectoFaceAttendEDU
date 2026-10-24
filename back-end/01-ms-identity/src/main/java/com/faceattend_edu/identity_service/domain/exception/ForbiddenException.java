package com.faceattend_edu.identity_service.domain.exception;

/** Authenticated, but not allowed to act on this resource (HTTP 403). */
public class ForbiddenException extends DomainException {
    private static final long serialVersionUID = 1L;

    public ForbiddenException(String message) {
        super(message);
    }
}
