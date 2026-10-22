package com.faceattend_edu.identity_service.domain.exception;

/** The password was right but the account has a second factor: a code was sent and the login must be completed with it. */
public class TwoFactorRequiredException extends DomainException {
    private static final long serialVersionUID = 1L;

    private final String maskedEmail;

    public TwoFactorRequiredException(String maskedEmail) {
        super("A verification code was sent to the account e-mail");
        this.maskedEmail = maskedEmail;
    }

    public String getMaskedEmail() {
        return maskedEmail;
    }
}
