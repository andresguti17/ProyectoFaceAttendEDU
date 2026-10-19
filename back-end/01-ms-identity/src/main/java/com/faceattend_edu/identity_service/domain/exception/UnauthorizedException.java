package com.faceattend_edu.identity_service.domain.exception;

public class UnauthorizedException extends DomainException {
    private static final long serialVersionUID = 1L;

    public UnauthorizedException() { super(); }
    public UnauthorizedException(String message) { super(message); }
    public UnauthorizedException(String message, Throwable cause) { super(message, cause); }
    public UnauthorizedException(Throwable cause) { super(cause); }
}
