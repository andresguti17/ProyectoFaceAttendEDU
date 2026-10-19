package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.port.in.DeletePermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DeletePermissionUseCaseImpl implements DeletePermissionUseCase {

    private final PermissionRepository permissionRepository;

    @Override
    public void deletePermission(Integer permissionId) {
        if (!permissionRepository.existsById(permissionId)) {
            throw new EntityNotFoundException("Permission", permissionId);
        }
        permissionRepository.deleteById(permissionId);
    }
}
