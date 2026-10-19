package com.faceattend_edu.authorization_service.application.usecase;

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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GetRoleUseCaseImplTest {

    @Mock RoleRepository roleRepository;

    private GetRoleUseCaseImpl useCase;

    @Test
    void returnsTheRoleWhenItExists() {
        useCase = new GetRoleUseCaseImpl(roleRepository);
        Role role = new Role();
        role.setRoleId(1);
        role.setRoleName("INSTRUCTOR");
        when(roleRepository.findById(1)).thenReturn(Optional.of(role));

        Role result = useCase.getRole(1);

        assertEquals("INSTRUCTOR", result.getRoleName());
    }

    @Test
    void throwsWhenTheRoleDoesNotExist() {
        useCase = new GetRoleUseCaseImpl(roleRepository);
        when(roleRepository.findById(999)).thenReturn(Optional.empty());

        assertThrows(EntityNotFoundException.class, () -> useCase.getRole(999));
    }
}
