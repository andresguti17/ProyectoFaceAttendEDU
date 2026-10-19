package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.in.GetPermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GetPermissionUseCaseImpl implements GetPermissionUseCase {

    private final PermissionRepository permissionRepository;

    @Override
    public Permission getPermission(Integer permissionId) {
        return permissionRepository.findById(permissionId)
                .orElseThrow(() -> new EntityNotFoundException("Permission", permissionId));
    }
}
