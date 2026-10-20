package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.NotifyUserCredentialsUseCase.Status;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.SendCredentialsEmailPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Entrega de credenciales iniciales: casos de omisión, fallo y éxito con cambio obligatorio. */
@ExtendWith(MockitoExtension.class)
@DisplayName("NotifyUserCredentialsUseCaseImpl unit tests")
class NotifyUserCredentialsUseCaseImplTest {

    @Mock LoadUserPort loadUserPort;
    @Mock LoadPersonPort loadPersonPort;
    @Mock UpdateUserPort updateUserPort;
    @Mock SendCredentialsEmailPort sendCredentialsEmailPort;

    private NotifyUserCredentialsUseCaseImpl useCase;
    private User user;
    private Person person;

    @BeforeEach
    void setUp() {
        useCase = new NotifyUserCredentialsUseCaseImpl(loadUserPort, loadPersonPort, updateUserPort, sendCredentialsEmailPort);
        person = new Person();
        person.setPersonId(UUID.randomUUID());
        person.setName("Ana");
        person.setLastName("Pérez");
        person.setEmail("ana@colegio.edu");
        Person reference = new Person();
        reference.setPersonId(person.getPersonId());
        user = new User();
        user.setUserId(UUID.randomUUID());
        user.setPersonId(reference);
        user.setUsername("ana.perez");
        user.setStatus(true);
    }

    @Test
    @DisplayName("fails with not found when the user does not exist")
    void unknownUser() {
        when(loadUserPort.loadUser(user.getUserId())).thenReturn(null);

        assertThatThrownBy(() -> useCase.notifyCredentials(user.getUserId(), "Secret123!"))
                .isInstanceOf(EntityNotFoundException.class);
        verifyNoInteractions(sendCredentialsEmailPort);
    }

    @Test
    @DisplayName("skips when the person has no email")
    void skipsWithoutEmail() {
        person.setEmail(" ");
        when(loadUserPort.loadUser(user.getUserId())).thenReturn(user);
        when(loadPersonPort.loadPerson(person.getPersonId())).thenReturn(person);

        assertThat(useCase.notifyCredentials(user.getUserId(), "Secret123!")).isEqualTo(Status.SKIPPED);
        verifyNoInteractions(sendCredentialsEmailPort);
        verify(updateUserPort, never()).updateUser(user);
    }

    @Test
    @DisplayName("skips an inactive account (pending activation)")
    void skipsInactive() {
        user.setStatus(false);
        when(loadUserPort.loadUser(user.getUserId())).thenReturn(user);
        when(loadPersonPort.loadPerson(person.getPersonId())).thenReturn(person);

        assertThat(useCase.notifyCredentials(user.getUserId(), "Secret123!")).isEqualTo(Status.SKIPPED);
        verifyNoInteractions(sendCredentialsEmailPort);
    }

    @Test
    @DisplayName("reports FAILED and leaves the flag off when delivery fails")
    void failedDelivery() {
        when(loadUserPort.loadUser(user.getUserId())).thenReturn(user);
        when(loadPersonPort.loadPerson(person.getPersonId())).thenReturn(person);
        when(sendCredentialsEmailPort.sendCredentials(anyString(), anyString(), anyString(), anyString())).thenReturn(false);

        assertThat(useCase.notifyCredentials(user.getUserId(), "Secret123!")).isEqualTo(Status.FAILED);
        assertThat(user.isMustChangePassword()).isFalse();
        verify(updateUserPort, never()).updateUser(user);
    }

    @Test
    @DisplayName("sends the credentials and forces a password change once the email is accepted")
    void sent() {
        when(loadUserPort.loadUser(user.getUserId())).thenReturn(user);
        when(loadPersonPort.loadPerson(person.getPersonId())).thenReturn(person);
        when(sendCredentialsEmailPort.sendCredentials("ana@colegio.edu", "Ana Pérez", "ana.perez", "Secret123!"))
                .thenReturn(true);

        assertThat(useCase.notifyCredentials(user.getUserId(), "Secret123!")).isEqualTo(Status.SENT);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(updateUserPort).updateUser(saved.capture());
        assertThat(saved.getValue().isMustChangePassword()).isTrue();
    }
}
