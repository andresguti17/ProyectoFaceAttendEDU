package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.UserRole;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import com.faceattend_edu.authorization_service.domain.port.out.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssignRoleToUserUseCaseImplTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock RoleRepository roleRepository;
    @Mock UserRoleRepository userRoleRepository;

    private AssignRoleToUserUseCaseImpl useCase;

    @Test
    void assignsTheRoleWhenItExistsAndIsNotAlreadyAssigned() {
        useCase = new AssignRoleToUserUseCaseImpl(roleRepository, userRoleRepository);
        when(roleRepository.existsById(1)).thenReturn(true);
        when(userRoleRepository.exists(USER_ID, 1)).thenReturn(false);

        useCase.assignRoleToUser(USER_ID, 1);

        ArgumentCaptor<UserRole> captor = ArgumentCaptor.forClass(UserRole.class);
        verify(userRoleRepository).save(captor.capture());
        assertEquals(USER_ID, captor.getValue().getUserId());
        assertEquals(1, captor.getValue().getRoleId());
    }

    @Test
    void throwsWhenTheRoleDoesNotExist() {
        useCase = new AssignRoleToUserUseCaseImpl(roleRepository, userRoleRepository);
        when(roleRepository.existsById(999)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> useCase.assignRoleToUser(USER_ID, 999));

        verify(userRoleRepository, never()).save(any());
    }

    @Test
    void rejectsAssigningTheSameRoleTwice() {
        useCase = new AssignRoleToUserUseCaseImpl(roleRepository, userRoleRepository);
        when(roleRepository.existsById(1)).thenReturn(true);
        when(userRoleRepository.exists(USER_ID, 1)).thenReturn(true);

        assertThrows(DuplicateEntityException.class, () -> useCase.assignRoleToUser(USER_ID, 1));

        verify(userRoleRepository, never()).save(any());
    }

    @Test
    void removesTheRoleWhenTheAssignmentExists() {
        useCase = new AssignRoleToUserUseCaseImpl(roleRepository, userRoleRepository);
        when(userRoleRepository.exists(USER_ID, 1)).thenReturn(true);

        useCase.removeRoleFromUser(USER_ID, 1);

        verify(userRoleRepository).delete(USER_ID, 1);
    }

    @Test
    void throwsWhenRemovingAnAssignmentThatDoesNotExist() {
        useCase = new AssignRoleToUserUseCaseImpl(roleRepository, userRoleRepository);
        when(userRoleRepository.exists(USER_ID, 1)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> useCase.removeRoleFromUser(USER_ID, 1));

        verify(userRoleRepository, never()).delete(USER_ID, 1);
    }

    @Test
    void assignDelegatesToAssignRoleToUser() {
        useCase = new AssignRoleToUserUseCaseImpl(roleRepository, userRoleRepository);
        when(roleRepository.existsById(1)).thenReturn(true);
        when(userRoleRepository.exists(USER_ID, 1)).thenReturn(false);

        useCase.assign(USER_ID, 1);

        verify(userRoleRepository).save(any(UserRole.class));
    }
}
