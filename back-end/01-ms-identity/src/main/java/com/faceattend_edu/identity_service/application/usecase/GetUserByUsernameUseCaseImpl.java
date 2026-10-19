package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.GetUserByUsernameUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@RequiredArgsConstructor
@Service
public class GetUserByUsernameUseCaseImpl implements GetUserByUsernameUseCase {

    private final LoadUserByIdentifierPort loadUserByIdentifierPort;

    @Override
    public User getUserByUsername(String username) {
        User user = loadUserByIdentifierPort.loadUserByIdentifier(username);
        if (user == null) {
            throw new EntityNotFoundException("User", username);
        }
        return user;
    }
}
