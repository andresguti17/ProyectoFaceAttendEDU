package com.faceattend_edu.identity_service.domain.exception;

public class SessionException extends DomainException {
    private static final long serialVersionUID = 1L;

    public SessionException() { super(); }
    public SessionException(String message) { super(message); }
    public SessionException(String message, Throwable cause) { super(message, cause); }
    public SessionException(Throwable cause) { super(cause); }
}
