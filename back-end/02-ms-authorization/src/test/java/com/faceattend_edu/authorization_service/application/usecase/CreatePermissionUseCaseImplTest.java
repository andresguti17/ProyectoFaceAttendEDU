package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.out.PermissionRepository;
import com.faceattend_edu.authorization_service.infrastructure.messaging.DomainEventPublisher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CreatePermissionUseCaseImplTest {

    @Mock PermissionRepository permissionRepository;
    @Mock DomainEventPublisher eventPublisher;

    private CreatePermissionUseCaseImpl useCase;

    private Permission savedPermission() {
        Permission permission = new Permission();
        permission.setPermissionId(1);
        permission.setPermissionName("attendance.justification:approve");
        permission.setDescription("Approve a justification");
        return permission;
    }

    @Test
    void createsAndPublishesWhenTheNameIsNotTaken() {
        useCase = new CreatePermissionUseCaseImpl(permissionRepository, eventPublisher);
        when(permissionRepository.findByPermissionName("attendance.justification:approve")).thenReturn(Optional.empty());
        when(permissionRepository.save(any(Permission.class))).thenReturn(savedPermission());

        Permission result = useCase.createPermission("attendance.justification:approve", "Approve a justification");

        assertEquals(1, result.getPermissionId());
        verify(eventPublisher).publish(any(String.class), any(String.class));
    }

    @Test
    void rejectsADuplicatePermissionName() {
        useCase = new CreatePermissionUseCaseImpl(permissionRepository, eventPublisher);
        when(permissionRepository.findByPermissionName("attendance.justification:approve"))
                .thenReturn(Optional.of(savedPermission()));

        assertThrows(DuplicateEntityException.class,
                () -> useCase.createPermission("attendance.justification:approve", "desc"));

        verify(permissionRepository, never()).save(any());
        verify(eventPublisher, never()).publish(any(), any());
    }

    @Test
    void rejectsABlankPermissionNameBeforeTouchingTheRepository() {
        useCase = new CreatePermissionUseCaseImpl(permissionRepository, eventPublisher);

        assertThrows(IllegalArgumentException.class, () -> useCase.createPermission("   ", "desc"));

        verify(permissionRepository, never()).save(any());
        verify(permissionRepository, never()).findByPermissionName(any());
    }
}
