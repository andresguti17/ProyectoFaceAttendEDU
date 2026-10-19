package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
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
class CreateRoleUseCaseImplTest {

    @Mock RoleRepository roleRepository;
    @Mock DomainEventPublisher eventPublisher;

    private CreateRoleUseCaseImpl useCase;

    private Role savedRole() {
        Role role = new Role();
        role.setRoleId(1);
        role.setRoleName("INSTRUCTOR");
        role.setDescription("Teaches classes");
        return role;
    }

    @Test
    void createsAndPublishesWhenTheNameIsNotTaken() {
        useCase = new CreateRoleUseCaseImpl(roleRepository, eventPublisher);
        when(roleRepository.findByRoleName("INSTRUCTOR")).thenReturn(Optional.empty());
        when(roleRepository.save(any(Role.class))).thenReturn(savedRole());

        Role result = useCase.createRole("INSTRUCTOR", "Teaches classes");

        assertEquals(1, result.getRoleId());
        verify(eventPublisher).publish(any(String.class), any(String.class));
    }

    @Test
    void rejectsADuplicateRoleName() {
        useCase = new CreateRoleUseCaseImpl(roleRepository, eventPublisher);
        when(roleRepository.findByRoleName("INSTRUCTOR")).thenReturn(Optional.of(savedRole()));

        assertThrows(DuplicateEntityException.class, () -> useCase.createRole("INSTRUCTOR", "desc"));

        verify(roleRepository, never()).save(any());
        verify(eventPublisher, never()).publish(any(), any());
    }

    @Test
    void rejectsABlankRoleNameBeforeTouchingTheRepository() {
        useCase = new CreateRoleUseCaseImpl(roleRepository, eventPublisher);

        assertThrows(IllegalArgumentException.class, () -> useCase.createRole("   ", "desc"));

        verify(roleRepository, never()).save(any());
        verify(roleRepository, never()).findByRoleName(any());
    }
}
