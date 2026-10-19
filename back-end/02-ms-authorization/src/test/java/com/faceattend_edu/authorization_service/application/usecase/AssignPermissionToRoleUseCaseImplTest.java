package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.RolePermission;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignPermissionToRoleUseCaseImplTest {

    @Mock RoleRepository roleRepository;
    @Mock PermissionRepository permissionRepository;
    @Mock RolePermissionRepository rolePermissionRepository;

    private AssignPermissionToRoleUseCaseImpl useCase;

    @Test
    void assignsThePermissionWhenRoleAndPermissionExistAndItIsNotAlreadyAssigned() {
        useCase = new AssignPermissionToRoleUseCaseImpl(roleRepository, permissionRepository, rolePermissionRepository);
        when(roleRepository.existsById(1)).thenReturn(true);
        when(permissionRepository.existsById(10)).thenReturn(true);
        when(rolePermissionRepository.exists(1, 10)).thenReturn(false);

        useCase.assignPermissionToRole(1, 10);

        ArgumentCaptor<RolePermission> captor = ArgumentCaptor.forClass(RolePermission.class);
        verify(rolePermissionRepository).save(captor.capture());
        assertEquals(1, captor.getValue().getRoleId());
        assertEquals(10, captor.getValue().getPermissionId());
    }

    @Test
    void throwsWhenTheRoleDoesNotExist() {
        useCase = new AssignPermissionToRoleUseCaseImpl(roleRepository, permissionRepository, rolePermissionRepository);
        when(roleRepository.existsById(999)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> useCase.assignPermissionToRole(999, 10));

        verify(rolePermissionRepository, never()).save(any());
    }

    @Test
    void throwsWhenThePermissionDoesNotExist() {
        useCase = new AssignPermissionToRoleUseCaseImpl(roleRepository, permissionRepository, rolePermissionRepository);
        when(roleRepository.existsById(1)).thenReturn(true);
        when(permissionRepository.existsById(999)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> useCase.assignPermissionToRole(1, 999));

        verify(rolePermissionRepository, never()).save(any());
    }

    @Test
    void rejectsAssigningThePermissionTwice() {
        useCase = new AssignPermissionToRoleUseCaseImpl(roleRepository, permissionRepository, rolePermissionRepository);
        when(roleRepository.existsById(1)).thenReturn(true);
        when(permissionRepository.existsById(10)).thenReturn(true);
        when(rolePermissionRepository.exists(1, 10)).thenReturn(true);

        assertThrows(DuplicateEntityException.class, () -> useCase.assignPermissionToRole(1, 10));

        verify(rolePermissionRepository, never()).save(any());
    }

    @Test
    void removesThePermissionWhenTheAssignmentExists() {
        useCase = new AssignPermissionToRoleUseCaseImpl(roleRepository, permissionRepository, rolePermissionRepository);
        when(rolePermissionRepository.exists(1, 10)).thenReturn(true);

        useCase.removePermissionFromRole(1, 10);

        verify(rolePermissionRepository).delete(1, 10);
    }

    @Test
    void throwsWhenRemovingAnAssignmentThatDoesNotExist() {
        useCase = new AssignPermissionToRoleUseCaseImpl(roleRepository, permissionRepository, rolePermissionRepository);
        when(rolePermissionRepository.exists(1, 10)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> useCase.removePermissionFromRole(1, 10));

        verify(rolePermissionRepository, never()).delete(1, 10);
    }
}
