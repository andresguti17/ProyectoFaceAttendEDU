package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.CheckPermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import com.faceattend_edu.authorization_service.domain.port.out.UserRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CheckPermissionUseCaseImpl implements CheckPermissionUseCase {

    private final UserRoleRepository userRoleRepository;
    private final RolePermissionRepository rolePermissionRepository;

    @Override
    public boolean hasPermission(UUID userId, String permissionName) {
        List<Role> roles = userRoleRepository.findRolesByUserId(userId);
        for (Role role : roles) {
            List<Permission> perms = rolePermissionRepository.findPermissionsByRoleId(role.getRoleId());
            for (Permission p : perms) {
                if (p.getPermissionName().equals(permissionName)) return true;
            }
        }
        return false;
    }
}
