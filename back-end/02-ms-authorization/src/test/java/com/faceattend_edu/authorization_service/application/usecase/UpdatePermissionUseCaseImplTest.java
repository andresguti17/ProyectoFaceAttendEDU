package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UpdatePermissionUseCaseImplTest {

    @Mock PermissionRepository permissionRepository;

    private UpdatePermissionUseCaseImpl useCase;

    private Permission existingPermission() {
        Permission permission = new Permission();
        permission.setPermissionId(1);
        permission.setPermissionName("attendance.justification:approve");
        permission.setDescription("Approve a justification");
        return permission;
    }

    @Test
    void updatesTheNameAndDescriptionWhenTheNewNameIsFree() {
        useCase = new UpdatePermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.findById(1)).thenReturn(Optional.of(existingPermission()));
        when(permissionRepository.findByPermissionName("attendance.justification:reject")).thenReturn(Optional.empty());
        when(permissionRepository.save(any(Permission.class))).thenAnswer(call -> call.getArgument(0));

        Permission result = useCase.updatePermission(1, "attendance.justification:reject", "Updated description");

        assertEquals("attendance.justification:reject", result.getPermissionName());
        assertEquals("Updated description", result.getDescription());
    }

    @Test
    void throwsWhenThePermissionDoesNotExist() {
        useCase = new UpdatePermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> useCase.updatePermission(999, "X", "Y"));

        verify(permissionRepository, never()).save(any());
    }

    @Test
    void rejectsRenamingToANameAlreadyUsedByAnotherPermission() {
        useCase = new UpdatePermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.findById(1)).thenReturn(Optional.of(existingPermission()));
        Permission other = new Permission();
        other.setPermissionId(2);
        other.setPermissionName("academic.cohort:create");
        when(permissionRepository.findByPermissionName("academic.cohort:create")).thenReturn(Optional.of(other));

        assertThrows(DuplicateEntityException.class,
                () -> useCase.updatePermission(1, "academic.cohort:create", "desc"));

        verify(permissionRepository, never()).save(any());
    }

    @Test
    void doesNotCheckForDuplicatesWhenTheNameIsUnchanged() {
        useCase = new UpdatePermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.findById(1)).thenReturn(Optional.of(existingPermission()));
        when(permissionRepository.save(any(Permission.class))).thenAnswer(call -> call.getArgument(0));

        Permission result = useCase.updatePermission(1, "attendance.justification:approve", "New description");

        assertEquals("New description", result.getDescription());
        verify(permissionRepository, never()).findByPermissionName(any());
    }

    @Test
    void keepsTheExistingDescriptionWhenNoneIsProvided() {
        useCase = new UpdatePermissionUseCaseImpl(permissionRepository);
        when(permissionRepository.findById(1)).thenReturn(Optional.of(existingPermission()));
        when(permissionRepository.save(any(Permission.class))).thenAnswer(call -> call.getArgument(0));

        Permission result = useCase.updatePermission(1, null, null);

        assertEquals("attendance.justification:approve", result.getPermissionName());
        assertEquals("Approve a justification", result.getDescription());
    }
}
