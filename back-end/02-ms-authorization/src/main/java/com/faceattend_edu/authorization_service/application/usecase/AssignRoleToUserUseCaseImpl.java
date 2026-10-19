package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.UserRole;
import com.faceattend_edu.authorization_service.domain.port.in.AssignRoleToUserUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.AssignRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import com.faceattend_edu.authorization_service.domain.port.out.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssignRoleToUserUseCaseImpl implements AssignRoleToUserUseCase, AssignRoleUseCase {

    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;

    @Override
    public void assignRoleToUser(UUID userId, Integer roleId) {
        if (!roleRepository.existsById(roleId)) throw new EntityNotFoundException("Role", roleId);
        if (userRoleRepository.exists(userId, roleId)) {
            throw new DuplicateEntityException("Role already assigned to user");
        }
        UserRole ur = new UserRole();
        ur.setUserId(userId);
        ur.setRoleId(roleId);
        ur.touchCreated();
        userRoleRepository.save(ur);
    }

    @Override
    public void removeRoleFromUser(UUID userId, Integer roleId) {
        if (!userRoleRepository.exists(userId, roleId)) {
            throw new EntityNotFoundException("UserRole", userId + "-" + roleId);
        }
        userRoleRepository.delete(userId, roleId);
    }

    @Override
    public void assign(UUID userId, Integer roleId) {
        assignRoleToUser(userId, roleId);
    }
}
