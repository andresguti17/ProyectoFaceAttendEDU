package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.RequestPasswordRecoveryUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort;
import com.faceattend_edu.identity_service.application.port.out.RecoveryCodePort.IssuedCode;
import com.faceattend_edu.identity_service.application.port.out.SendRecoveryEmailPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.shared.util.Emails;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;

@RequiredArgsConstructor
@Service
public class RequestPasswordRecoveryUseCaseImpl implements RequestPasswordRecoveryUseCase {

    private static final Logger log = LoggerFactory.getLogger(RequestPasswordRecoveryUseCaseImpl.class);

    private final LoadUserByIdentifierPort loadUserByIdentifierPort;
    private final RecoveryCodePort recoveryCodePort;
    private final SendRecoveryEmailPort sendRecoveryEmailPort;
    private final AuthProperties authProperties;

    @Override
    public void requestCode(String email) {
        if (!Emails.isWellFormed(email)) {
            throw new ValidationException("A valid email is required");
        }
        String address = Emails.normalize(email);

        User user = loadUserByIdentifierPort.loadUserByIdentifier(address);
        if (user == null || !user.isActive()) {
            // Anti-enumeración: misma respuesta (202) que para una cuenta real.
            log.info("Password recovery requested for unknown or inactive account");
            return;
        }

        Duration ttl = authProperties.codeTtl();
        IssuedCode issued = recoveryCodePort.issue(address, ttl);
        if (issued == null) {
            // Cooldown de reenvío: no se emite otro código todavía.
            log.info("Password recovery resend throttled");
            return;
        }

        if (!sendRecoveryEmailPort.sendRecoveryCode(issued.email(), issued.code(), ttl)) {
            // El código sigue vivo en memoria: si notification se recupera el
            // usuario puede pedir otro reenvío cuando venza la ventana de espera.
            log.warn("Recovery code generated but not delivered to {}", issued.email());
        }
    }
}
