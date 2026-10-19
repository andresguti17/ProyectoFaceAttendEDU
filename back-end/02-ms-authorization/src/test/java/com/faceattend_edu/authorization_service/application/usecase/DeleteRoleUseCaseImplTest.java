package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeleteRoleUseCaseImplTest {

    @Mock RoleRepository roleRepository;

    private DeleteRoleUseCaseImpl useCase;

    @Test
    void deletesTheRoleWhenItExists() {
        useCase = new DeleteRoleUseCaseImpl(roleRepository);
        when(roleRepository.existsById(1)).thenReturn(true);

        useCase.deleteRole(1);

        verify(roleRepository).deleteById(1);
    }

    @Test
    void throwsWhenTheRoleDoesNotExist() {
        useCase = new DeleteRoleUseCaseImpl(roleRepository);
        when(roleRepository.existsById(999)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> useCase.deleteRole(999));

        verify(roleRepository, never()).deleteById(999);
    }
}
