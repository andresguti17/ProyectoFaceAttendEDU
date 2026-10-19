package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import com.faceattend_edu.authorization_service.domain.port.out.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CheckPermissionUseCaseImplTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock UserRoleRepository userRoleRepository;
    @Mock RolePermissionRepository rolePermissionRepository;

    private CheckPermissionUseCaseImpl useCase;

    private Role role(int id) {
        Role role = new Role();
        role.setRoleId(id);
        return role;
    }

    private Permission permission(String name) {
        Permission permission = new Permission();
        permission.setPermissionName(name);
        return permission;
    }

    @Test
    void returnsTrueWhenOneOfTheUsersRolesHasThePermission() {
        useCase = new CheckPermissionUseCaseImpl(userRoleRepository, rolePermissionRepository);
        when(userRoleRepository.findRolesByUserId(USER_ID)).thenReturn(List.of(role(1)));
        when(rolePermissionRepository.findPermissionsByRoleId(1))
                .thenReturn(List.of(permission("attendance.justification:approve")));

        boolean result = useCase.hasPermission(USER_ID, "attendance.justification:approve");

        assertTrue(result);
    }

    @Test
    void returnsFalseWhenTheUserHasNoRoles() {
        useCase = new CheckPermissionUseCaseImpl(userRoleRepository, rolePermissionRepository);
        when(userRoleRepository.findRolesByUserId(USER_ID)).thenReturn(List.of());

        boolean result = useCase.hasPermission(USER_ID, "attendance.justification:approve");

        assertFalse(result);
        verify(rolePermissionRepository, never()).findPermissionsByRoleId(org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void returnsFalseWhenNoRoleGrantsTheRequestedPermission() {
        useCase = new CheckPermissionUseCaseImpl(userRoleRepository, rolePermissionRepository);
        when(userRoleRepository.findRolesByUserId(USER_ID)).thenReturn(List.of(role(1)));
        when(rolePermissionRepository.findPermissionsByRoleId(1))
                .thenReturn(List.of(permission("academic.cohort:create")));

        boolean result = useCase.hasPermission(USER_ID, "attendance.justification:approve");

        assertFalse(result);
    }

    @Test
    void checksEveryRoleUntilThePermissionIsFound() {
        useCase = new CheckPermissionUseCaseImpl(userRoleRepository, rolePermissionRepository);
        when(userRoleRepository.findRolesByUserId(USER_ID)).thenReturn(List.of(role(1), role(2)));
        when(rolePermissionRepository.findPermissionsByRoleId(1))
                .thenReturn(List.of(permission("academic.cohort:create")));
        when(rolePermissionRepository.findPermissionsByRoleId(2))
                .thenReturn(List.of(permission("attendance.justification:approve")));

        boolean result = useCase.hasPermission(USER_ID, "attendance.justification:approve");

        assertTrue(result);
        verify(rolePermissionRepository).findPermissionsByRoleId(1);
        verify(rolePermissionRepository).findPermissionsByRoleId(2);
    }
}
