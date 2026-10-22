package com.faceattend_edu.identity_service.domain.exception;

/** A verification code could not be e-mailed (no address on file or the e-mail channel is down). */
public class EmailDeliveryException extends DomainException {
    private static final long serialVersionUID = 1L;

    public EmailDeliveryException(String message) {
        super(message);
    }
}
