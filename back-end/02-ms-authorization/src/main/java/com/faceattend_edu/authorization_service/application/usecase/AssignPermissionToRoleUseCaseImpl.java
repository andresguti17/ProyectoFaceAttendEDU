package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.RolePermission;
import com.faceattend_edu.authorization_service.domain.port.in.AssignPermissionToRoleUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AssignPermissionToRoleUseCaseImpl implements AssignPermissionToRoleUseCase {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final RolePermissionRepository rolePermissionRepository;

    @Override
    public void assignPermissionToRole(Integer roleId, Integer permissionId) {
        if (!roleRepository.existsById(roleId)) throw new EntityNotFoundException("Role", roleId);
        if (!permissionRepository.existsById(permissionId)) throw new EntityNotFoundException("Permission", permissionId);
        if (rolePermissionRepository.exists(roleId, permissionId)) {
            throw new DuplicateEntityException("Permission already assigned to role");
        }
        RolePermission rp = new RolePermission();
        rp.setRoleId(roleId);
        rp.setPermissionId(permissionId);
        rp.touchCreated();
        rolePermissionRepository.save(rp);
    }

    @Override
    public void removePermissionFromRole(Integer roleId, Integer permissionId) {
        if (!rolePermissionRepository.exists(roleId, permissionId)) {
            throw new EntityNotFoundException("RolePermission", roleId + "-" + permissionId);
        }
        rolePermissionRepository.delete(roleId, permissionId);
    }
}
