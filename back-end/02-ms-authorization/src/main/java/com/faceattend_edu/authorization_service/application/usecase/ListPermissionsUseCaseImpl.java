package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.in.ListPermissionsUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ListPermissionsUseCaseImpl implements ListPermissionsUseCase {

    private final PermissionRepository permissionRepository;

    @Override
    public List<Permission> listPermissions() {
        return permissionRepository.findAll();
    }
}
