package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeletePermissionUseCaseImplTest {

    @Mock PermissionRepository permissionRepository;

    private DeletePermissionUseCaseImpl useCase;

    @Test
    void deletesThePermissionWhenItExists() {
        useCase = new DeletePermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.existsById(1)).thenReturn(true);

        useCase.deletePermission(1);

        verify(permissionRepository).deleteById(1);
    }

    @Test
    void throwsWhenThePermissionDoesNotExist() {
        useCase = new DeletePermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.existsById(999)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> useCase.deletePermission(999));

        verify(permissionRepository, never()).deleteById(999);
    }
}
