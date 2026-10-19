package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.port.in.DeleteRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeleteRoleUseCaseImpl implements DeleteRoleUseCase {

    private final RoleRepository roleRepository;

    @Override
    public void deleteRole(Integer roleId) {
        if (!roleRepository.existsById(roleId)) {
            throw new EntityNotFoundException("Role", roleId);
        }
        roleRepository.deleteById(roleId);
    }
}
