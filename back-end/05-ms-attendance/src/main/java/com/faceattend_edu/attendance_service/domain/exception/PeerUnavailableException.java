package com.faceattend_edu.attendance_service.domain.exception;

/** Another service needed to decide the request did not answer; the request is not applied (503). */
public class PeerUnavailableException extends DomainException {
    public PeerUnavailableException(String message, Throwable cause) { super(message, cause); }
}
