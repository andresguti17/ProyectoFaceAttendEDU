package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.in.UpdatePermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UpdatePermissionUseCaseImpl implements UpdatePermissionUseCase {

    private final PermissionRepository permissionRepository;

    @Override
    public Permission updatePermission(Integer permissionId, String permissionName, String description) {
        Permission existing = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new EntityNotFoundException("Permission", permissionId));
        if (permissionName != null && !permissionName.equals(existing.getPermissionName())) {
            permissionRepository.findByPermissionName(permissionName).ifPresent(ex -> {
                throw new DuplicateEntityException("Permission already exists with name=" + permissionName);
            });
            existing.setPermissionName(permissionName);
        }
        if (description != null) existing.setDescription(description);
        existing.validate();
        existing.touchUpdated();
        return permissionRepository.save(existing);
    }
}
