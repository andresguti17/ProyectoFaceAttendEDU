package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.UpdateRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UpdateRoleUseCaseImpl implements UpdateRoleUseCase {

    private final RoleRepository roleRepository;

    @Override
    public Role updateRole(Integer roleId, String roleName, String description) {
        Role existing = roleRepository.findById(roleId)
                .orElseThrow(() -> new EntityNotFoundException("Role", roleId));
        if (roleName != null && !roleName.equals(existing.getRoleName())) {
            roleRepository.findByRoleName(roleName).ifPresent(r -> {
                throw new DuplicateEntityException("Role already exists with name=" + roleName);
            });
            existing.setRoleName(roleName);
        }
        if (description != null) existing.setDescription(description);
        existing.validate();
        existing.touchUpdated();
        return roleRepository.save(existing);
    }
}
