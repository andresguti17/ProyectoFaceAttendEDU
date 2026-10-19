package com.faceattend_edu.attendance_service.domain.exception;

public class DuplicateEntityException extends DomainException {
    public DuplicateEntityException(String message){ super(message); }
    public DuplicateEntityException(String message, Throwable cause){ super(message, cause); }
}
