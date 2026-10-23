package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort.IssuedCode;
import com.faceattend_edu.identity_service.application.port.out.SendLoginCodePort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.EmailDeliveryException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;

/**
 * The e-mailed code of the second factor. It reuses the store of the password-recovery codes
 * (6 digits, hashed, expiry, 5 attempts, resend cooldown) under its own key namespace, so a
 * login code can never be confused with a recovery code.
 */
@Service
@RequiredArgsConstructor
public class TwoFactorChallenge {

    private static final String KEY_PREFIX = "2fa:";

    private final RecoveryCodePort codes;
    private final SendLoginCodePort sender;
    private final AuthProperties authProperties;

    /**
     * Issues a code and e-mails it to the account address. Inside the resend cooldown no new code
     * is issued: the one already sent is still valid.
     *
     * @return the address with its middle masked, for the client to show
     * @throws EmailDeliveryException without an address on file or when the e-mail channel fails
     */
    public String begin(User user) {
        Person person = user.getPersonId();
        String email = person == null || person.getEmail() == null ? "" : person.getEmail().trim();
        if (email.isEmpty()) {
            throw new EmailDeliveryException("The account has no e-mail address to send the code to");
        }
        Duration ttl = authProperties.codeTtl();
        IssuedCode issued = codes.issue(key(user), ttl);
        if (issued != null && !sender.sendLoginCode(email, person.getName(), issued.code(), ttl)) {
            throw new EmailDeliveryException("The verification code could not be sent");
        }
        return mask(email);
    }

    /** Checks the code and spends it (single use). */
    public boolean verify(User user, String code) {
        String digits = code == null ? "" : code.trim();
        if (!digits.matches("\\d{6}")) return false;
        return codes.verify(key(user), digits) && codes.consumeVerified(key(user));
    }

    static String key(User user) {
        return KEY_PREFIX + user.getUserId();
    }

    /** "ana.perez@example.com" becomes "a***@example.com". */
    static String mask(String email) {
        int at = email.indexOf('@');
        if (at <= 0) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }
}
