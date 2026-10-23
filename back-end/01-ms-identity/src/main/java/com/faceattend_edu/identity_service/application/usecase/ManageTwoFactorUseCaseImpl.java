package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ManageTwoFactorUseCase;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class ManageTwoFactorUseCaseImpl implements ManageTwoFactorUseCase {

    private final LoadUserPort loadUserPort;
    private final UpdateUserPort updateUserPort;
    private final HashPasswordPort hashPasswordPort;
    private final TwoFactorChallenge challenge;

    @Override
    public String requestEnable(UUID userId, String password) {
        User user = requireWithPassword(userId, password);
        return challenge.begin(user);
    }

    @Override
    @Transactional
    public void confirmEnable(UUID userId, String code) {
        User user = load(userId);
        if (!challenge.verify(user, code)) {
            throw new UnauthorizedException("Invalid or expired code");
        }
        user.setTwoFactorEnabled(true);
        user.setUpdatedAt(LocalDateTime.now());
        updateUserPort.updateUser(user);
    }

    @Override
    @Transactional
    public void disable(UUID userId, String password) {
        User user = requireWithPassword(userId, password);
        user.setTwoFactorEnabled(false);
        user.setUpdatedAt(LocalDateTime.now());
        updateUserPort.updateUser(user);
    }

    private User load(UUID userId) {
        User user = loadUserPort.loadUser(userId);
        if (user == null || !user.isActive()) {
            throw new UnauthorizedException("Authentication required");
        }
        return user;
    }

    private User requireWithPassword(UUID userId, String password) {
        User user = load(userId);
        if (password == null || !hashPasswordPort.matches(password, user.getPasswordHash())) {
            throw new ValidationException("Current password is incorrect");
        }
        return user;
    }
}
