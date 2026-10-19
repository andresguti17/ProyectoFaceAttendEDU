package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.VerifyRecoveryCodeUseCase;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.shared.util.Emails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@RequiredArgsConstructor
@Service
public class VerifyRecoveryCodeUseCaseImpl implements VerifyRecoveryCodeUseCase {

    private final RecoveryCodePort recoveryCodePort;

    @Override
    public void verify(String email, String code) {
        if (!Emails.isWellFormed(email)) {
            throw new ValidationException("A valid email is required");
        }
        String digits = code == null ? "" : code.trim();
        if (!digits.matches("\\d{6}")) {
            throw new ValidationException("Code must be 6 digits");
        }
        // 401: el código es incorrecto, venció o se agotaron los intentos. El
        // mensaje es único para no filtrar cuál de los tres casos ocurrió.
        if (!recoveryCodePort.verify(Emails.normalize(email), digits)) {
            throw new UnauthorizedException("Invalid or expired code");
        }
    }
}
