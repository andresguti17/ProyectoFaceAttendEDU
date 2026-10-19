package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GetPermissionUseCaseImplTest {

    @Mock PermissionRepository permissionRepository;

    private GetPermissionUseCaseImpl useCase;

    @Test
    void returnsThePermissionWhenItExists() {
        useCase = new GetPermissionUseCaseImpl(permissionRepository);
        Permission permission = new Permission();
        permission.setPermissionId(1);
        permission.setPermissionName("attendance.justification:approve");
        when(permissionRepository.findById(1)).thenReturn(Optional.of(permission));

        Permission result = useCase.getPermission(1);

        assertEquals("attendance.justification:approve", result.getPermissionName());
    }

    @Test
    void throwsWhenThePermissionDoesNotExist() {
        useCase = new GetPermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> useCase.getPermission(999));
    }
}
