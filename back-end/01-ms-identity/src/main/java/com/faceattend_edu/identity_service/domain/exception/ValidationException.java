package com.faceattend_edu.identity_service.domain.exception;

public class ValidationException extends DomainException {
    private static final long serialVersionUID = 1L;

    public ValidationException() { super(); }
    public ValidationException(String message) { super(message); }
    public ValidationException(String message, Throwable cause) { super(message, cause); }
    public ValidationException(Throwable cause) { super(cause); }
}
