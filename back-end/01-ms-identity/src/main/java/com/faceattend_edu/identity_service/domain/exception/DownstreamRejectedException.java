package com.faceattend_edu.identity_service.domain.exception;

/**
 * Another bounded context refused a step of a composite operation with a client error
 * (400, 403, 404 or 409): the caller gets the same status and reason.
 */
public class DownstreamRejectedException extends DomainException {
    private static final long serialVersionUID = 1L;

    private final int status;

    public DownstreamRejectedException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
