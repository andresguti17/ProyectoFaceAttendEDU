package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
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
class UpdateRoleUseCaseImplTest {

    @Mock RoleRepository roleRepository;

    private UpdateRoleUseCaseImpl useCase;

    private Role existingRole() {
        Role role = new Role();
        role.setRoleId(1);
        role.setRoleName("INSTRUCTOR");
        role.setDescription("Teaches classes");
        return role;
    }

    @Test
    void updatesTheNameAndDescriptionWhenTheNewNameIsFree() {
        useCase = new UpdateRoleUseCaseImpl(roleRepository);
        when(roleRepository.findById(1)).thenReturn(Optional.of(existingRole()));
        when(roleRepository.findByRoleName("SENIOR_INSTRUCTOR")).thenReturn(Optional.empty());
        when(roleRepository.save(any(Role.class))).thenAnswer(call -> call.getArgument(0));

        Role result = useCase.updateRole(1, "SENIOR_INSTRUCTOR", "Updated description");

        assertEquals("SENIOR_INSTRUCTOR", result.getRoleName());
        assertEquals("Updated description", result.getDescription());
    }

    @Test
    void throwsWhenTheRoleDoesNotExist() {
        useCase = new UpdateRoleUseCaseImpl(roleRepository);
        when(roleRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> useCase.updateRole(999, "X", "Y"));

        verify(roleRepository, never()).save(any());
    }

    @Test
    void rejectsRenamingToANameAlreadyUsedByAnotherRole() {
        useCase = new UpdateRoleUseCaseImpl(roleRepository);
        when(roleRepository.findById(1)).thenReturn(Optional.of(existingRole()));
        Role other = new Role();
        other.setRoleId(2);
        other.setRoleName("SCHOOL_ADMIN");
        when(roleRepository.findByRoleName("SCHOOL_ADMIN")).thenReturn(Optional.of(other));

        assertThrows(DuplicateEntityException.class, () -> useCase.updateRole(1, "SCHOOL_ADMIN", "desc"));

        verify(roleRepository, never()).save(any());
    }

    @Test
    void doesNotCheckForDuplicatesWhenTheNameIsUnchanged() {
        useCase = new UpdateRoleUseCaseImpl(roleRepository);
        when(roleRepository.findById(1)).thenReturn(Optional.of(existingRole()));
        when(roleRepository.save(any(Role.class))).thenAnswer(call -> call.getArgument(0));

        Role result = useCase.updateRole(1, "INSTRUCTOR", "New description");

        assertEquals("New description", result.getDescription());
        verify(roleRepository, never()).findByRoleName(any());
    }

    @Test
    void keepsTheExistingDescriptionWhenNoneIsProvided() {
        useCase = new UpdateRoleUseCaseImpl(roleRepository);
        when(roleRepository.findById(1)).thenReturn(Optional.of(existingRole()));
        when(roleRepository.save(any(Role.class))).thenAnswer(call -> call.getArgument(0));

        Role result = useCase.updateRole(1, null, null);

        assertEquals("INSTRUCTOR", result.getRoleName());
        assertEquals("Teaches classes", result.getDescription());
    }
}
