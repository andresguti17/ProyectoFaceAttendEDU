package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.adapter.out.messaging.DomainEventPublisher;
import com.faceattend_edu.identity_service.application.port.out.ListUsersPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserSessionPort;
import com.faceattend_edu.identity_service.application.port.out.SavePasswordPolicyPort;
import com.faceattend_edu.identity_service.application.port.out.UpdatePersonPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserSessionPort;
import com.faceattend_edu.identity_service.config.AuthProperties;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import com.faceattend_edu.identity_service.domain.service.UserActivationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Account and person maintenance use cases")
class IdentityMaintenanceUseCasesTest {

    private static final UUID USER_ID = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID PERSON_ID = UUID.fromString("22222222-2222-4222-8222-222222222222");

    private final LoadUserPort loadUser = mock(LoadUserPort.class);
    private final UpdateUserPort updateUser = mock(UpdateUserPort.class);
    private final LoadPersonPort loadPerson = mock(LoadPersonPort.class);
    private final UpdatePersonPort updatePerson = mock(UpdatePersonPort.class);

    private static Person person() {
        Person p = new Person();
        p.setPersonId(PERSON_ID);
        p.setDocumentNumber("1020");
        p.setName("Ana");
        p.setLastName("Pérez");
        p.setStatus(true);
        p.setCreatedAt(LocalDateTime.of(2026, 1, 1, 8, 0));
        return p;
    }

    private static User storedUser() {
        User u = new User();
        u.setUserId(USER_ID);
        u.setPersonId(person());
        u.setUsername("ana.perez");
        u.setPasswordHash("$2a$12$hash");
        u.setStatus(true);
        u.setMustChangePassword(true);
        u.setCreatedAt(LocalDateTime.of(2026, 1, 1, 8, 0));
        return u;
    }

    @Test
    void aPartialAccountUpdateKeepsTheCredentialAndTheForcedChangeFlag() {
        when(loadUser.loadUser(USER_ID)).thenReturn(storedUser());
        User patch = new User();
        patch.setUserId(USER_ID);
        patch.setUsername("ana.p");
        patch.setMustChangePassword(false);
        new UpdateUserUseCaseImpl(updateUser, loadUser).updateUser(patch);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(updateUser).updateUser(saved.capture());
        assertThat(saved.getValue().getPasswordHash()).isEqualTo("$2a$12$hash");
        assertThat(saved.getValue().getUsername()).isEqualTo("ana.p");
        assertThat(saved.getValue().isMustChangePassword()).isTrue();
        assertThat(saved.getValue().getUpdatedAt()).isNotNull();

        User unknown = new User();
        unknown.setUserId(UUID.randomUUID());
        assertThatThrownBy(() -> new UpdateUserUseCaseImpl(updateUser, loadUser).updateUser(unknown)).isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void personUpdatesKeepAuditFieldsAndValidate() {
        when(loadPerson.loadPerson(PERSON_ID)).thenReturn(person());
        Person incoming = person();
        incoming.setPersonId(null);
        incoming.setStatus(null);
        incoming.setName("Ana María");
        new UpdatePersonUseCaseImpl(loadPerson, updatePerson).updatePerson(PERSON_ID, incoming);
        ArgumentCaptor<Person> saved = ArgumentCaptor.forClass(Person.class);
        verify(updatePerson).updatePerson(saved.capture());
        assertThat(saved.getValue().getPersonId()).isEqualTo(PERSON_ID);
        assertThat(saved.getValue().getStatus()).isTrue();
        assertThat(saved.getValue().getCreatedAt()).isEqualTo(LocalDateTime.of(2026, 1, 1, 8, 0));

        Person invalid = person();
        invalid.setEmail("no-es-correo");
        assertThatThrownBy(() -> new UpdatePersonUseCaseImpl(loadPerson, updatePerson).updatePerson(PERSON_ID, invalid))
                .hasMessage("Person.email is not a valid email");
        assertThatThrownBy(() -> new UpdatePersonUseCaseImpl(loadPerson, updatePerson).updatePerson(UUID.randomUUID(), person()))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void statusChangesAndActivationOnlyTouchExistingRecords() {
        when(loadUser.loadUser(USER_ID)).thenReturn(storedUser());
        new ChangeUserStatusUseCaseImpl(loadUser, updateUser).changeStatus(USER_ID, false);
        verify(updateUser).updateUser(any(User.class));
        assertThatThrownBy(() -> new ChangeUserStatusUseCaseImpl(loadUser, updateUser).changeStatus(UUID.randomUUID(), false))
                .isInstanceOf(EntityNotFoundException.class);

        when(loadPerson.loadPerson(PERSON_ID)).thenReturn(person());
        new ChangePersonStatusUseCaseImpl(loadPerson, updatePerson).changeStatus(PERSON_ID, false);
        ArgumentCaptor<Person> person = ArgumentCaptor.forClass(Person.class);
        verify(updatePerson).updatePerson(person.capture());
        assertThat(person.getValue().getStatus()).isFalse();
        assertThatThrownBy(() -> new ChangePersonStatusUseCaseImpl(loadPerson, updatePerson).changeStatus(UUID.randomUUID(), true))
                .isInstanceOf(EntityNotFoundException.class);

        UserActivationService activation = mock(UserActivationService.class);
        UpdateUserPort activationUpdates = mock(UpdateUserPort.class);
        new ActivateUserUseCaseImpl(loadUser, activationUpdates, activation).activateUser(USER_ID);
        verify(activation).activateUser(any(User.class));
        verify(activationUpdates).updateUser(any(User.class));
        assertThatThrownBy(() -> new ActivateUserUseCaseImpl(loadUser, activationUpdates, activation).activateUser(UUID.randomUUID()))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void anExpiredSessionIsClosedOnReadAndAFreshOneIsLeftAlone() {
        LoadUserSessionPort load = mock(LoadUserSessionPort.class);
        UpdateUserSessionPort update = mock(UpdateUserSessionPort.class);
        AuthProperties properties = new AuthProperties();
        GetUserSessionUseCaseImpl useCase = new GetUserSessionUseCaseImpl(load, update, properties);

        UserSession old = new UserSession();
        old.start();
        old.setStartDate(LocalDateTime.now().minusHours(9));
        UUID oldId = UUID.randomUUID();
        when(load.loadUserSession(oldId)).thenReturn(old);
        assertThat(useCase.getUserSession(oldId).isActive()).isFalse();
        verify(update).updateUserSession(old);

        UserSession fresh = new UserSession();
        fresh.start();
        UUID freshId = UUID.randomUUID();
        when(load.loadUserSession(freshId)).thenReturn(fresh);
        assertThat(useCase.getUserSession(freshId).isActive()).isTrue();
        verify(update, never()).updateUserSession(fresh);

        assertThatThrownBy(() -> useCase.getUserSession(UUID.randomUUID())).isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void aPasswordPolicyIsValidatedSavedAndAnnounced() {
        SavePasswordPolicyPort save = mock(SavePasswordPolicyPort.class);
        DomainEventPublisher events = mock(DomainEventPublisher.class);
        PasswordPolicy policy = new PasswordPolicy();
        policy.setMinLength(8);
        policy.setMaxLength(20);
        policy.setExpirationDays(90);
        when(save.savePolicy(any())).thenAnswer(inv -> {
            PasswordPolicy saved = inv.getArgument(0);
            saved.setPolicyId(4);
            return saved;
        });
        assertThat(new CreatePasswordPolicyUseCaseImpl(save, events).createPolicy(policy).getCreatedAt()).isNotNull();
        verify(events).publish(eq("password-policy-events"), contains("\"policyId\":4"));

        PasswordPolicy invalid = new PasswordPolicy();
        invalid.setMinLength(10);
        invalid.setMaxLength(5);
        invalid.setExpirationDays(30);
        assertThatThrownBy(() -> new CreatePasswordPolicyUseCaseImpl(save, events).createPolicy(invalid))
                .hasMessage("PasswordPolicy.maxLength must be >= minLength");
    }

    @Test
    void listingUsersDelegatesWithAndWithoutAScope() {
        ListUsersPort port = mock(ListUsersPort.class);
        when(port.listUsers(0, 20)).thenReturn(List.of(storedUser()));
        when(port.countUsers()).thenReturn(1L);
        when(port.listUsers(0, 20, Set.of(PERSON_ID))).thenReturn(List.of());
        when(port.countUsers(Set.of(PERSON_ID))).thenReturn(0L);
        ListUsersUseCaseImpl useCase = new ListUsersUseCaseImpl(port);
        assertThat(useCase.listUsers(0, 20)).hasSize(1);
        assertThat(useCase.countUsers()).isEqualTo(1L);
        assertThat(useCase.listUsers(0, 20, Set.of(PERSON_ID))).isEmpty();
        assertThat(useCase.countUsers(Set.of(PERSON_ID))).isZero();
    }
}
