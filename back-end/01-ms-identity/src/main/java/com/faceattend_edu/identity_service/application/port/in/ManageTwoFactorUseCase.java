package com.faceattend_edu.identity_service.application.port.in;

import java.util.UUID;

/** Turning the e-mail second factor on and off for the caller's own account. */
public interface ManageTwoFactorUseCase {

    /**
     * Starts enabling: checks the password and e-mails a code to the account address, so a wrong
     * address cannot lock the person out. Nothing changes until {@link #confirmEnable}.
     *
     * @return the masked address the code went to
     */
    String requestEnable(UUID userId, String password);

    /** Finishes enabling with the code that was e-mailed. */
    void confirmEnable(UUID userId, String code);

    /** Turns it off; needs the account password. */
    void disable(UUID userId, String password);
}
