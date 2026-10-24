package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.CreatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.NotifyUserCredentialsUseCase;
import com.faceattend_edu.identity_service.application.port.in.ProvisionUserUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByUsernamePort;
import com.faceattend_edu.identity_service.application.port.out.RemoveIdentityPort;
import com.faceattend_edu.identity_service.application.port.out.UserProvisioningPort;
import com.faceattend_edu.identity_service.domain.exception.DownstreamRejectedException;
import com.faceattend_edu.identity_service.domain.exception.OnboardingUnavailableException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Account provisioning with server-side compensation")
class ProvisionUserUseCaseImplTest {

    private static final String TOKEN = "11111111-2222-3333-4444-555555555555";

    @Mock CreatePersonUseCase createPerson;
    @Mock CreateUserUseCase createUser;
    @Mock NotifyUserCredentialsUseCase notify;
    @Mock LoadUserByUsernamePort loadByUsername;
    @Mock UserProvisioningPort provisioning;
    @Mock RemoveIdentityPort removeIdentity;
    @Mock com.faceattend_edu.identity_service.application.port.in.ManageConsentUseCase consent;
    @InjectMocks ProvisionUserUseCaseImpl useCase;

    private final UUID personId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void identityRows() {
        lenient().when(consent.currentPolicyVersion()).thenReturn("2026-10");
        lenient().when(createPerson.createPerson(any())).thenAnswer(call -> {
            Person p = call.getArgument(0);
            p.setPersonId(personId);
            return p;
        });
        lenient().when(createUser.createUser(any(), anyString())).thenAnswer(call -> {
            User u = call.getArgument(0);
            u.setUserId(userId);
            return u;
        });
    }

    private static final ProvisionUserUseCase.Consent CONSENT = new ProvisionUserUseCase.Consent("2026-10", true);
    private static final UUID ADMIN = UUID.randomUUID();

    private static ProvisionUserUseCase.Command apprentice() {
        Person person = new Person();
        person.setDocumentNumber("1001");
        person.setName("Ana");
        person.setLastName("Rios");
        return new ProvisionUserUseCase.Command(person, "ana.rios", "Temporal-2026", false, "Aprendiz",
                new ProvisionUserUseCase.Actor(1, 4L, "APR-1001", 9L), CONSENT);
    }

    @Test
    void createsEveryPieceAndReturnsTheIds() {
        when(provisioning.createActor(TOKEN, personId, 1, 4L, "APR-1001")).thenReturn(30L);
        when(provisioning.createEnrollment(TOKEN, 30L, 9L)).thenReturn(40L);

        ProvisionUserUseCase.Result result = useCase.provision(apprentice(), TOKEN, ADMIN);

        assertThat(result.userId()).isEqualTo(userId);
        assertThat(result.academicActorId()).isEqualTo(30L);
        assertThat(result.enrollmentId()).isEqualTo(40L);
        verify(provisioning).assignRole(TOKEN, userId, "Aprendiz");
        verifyNoInteractions(removeIdentity);
    }

    @Test
    @DisplayName("Role assignment fails: enrollment, actor and identity rows are all removed")
    void roleFailureUndoesEverything() {
        when(provisioning.createActor(TOKEN, personId, 1, 4L, "APR-1001")).thenReturn(30L);
        when(provisioning.createEnrollment(TOKEN, 30L, 9L)).thenReturn(40L);
        doThrow(new OnboardingUnavailableException("authorization down")).when(provisioning).assignRole(TOKEN, userId, "Aprendiz");

        assertThatThrownBy(() -> useCase.provision(apprentice(), TOKEN, ADMIN)).isInstanceOf(OnboardingUnavailableException.class);

        verify(provisioning).removeRole(TOKEN, userId, "Aprendiz");
        verify(provisioning).deleteEnrollment(TOKEN, 40L);
        verify(provisioning).deleteActor(TOKEN, 30L);
        verify(removeIdentity).removeUserAndPerson(userId, personId);
    }

    @Test
    @DisplayName("Actor creation times out: actors found for the person are removed, then identity rows")
    void actorTimeoutLooksActorsUp() {
        when(provisioning.createActor(TOKEN, personId, 1, 4L, "APR-1001"))
                .thenThrow(new OnboardingUnavailableException("no answer"));
        when(provisioning.findActorIdsByPerson(TOKEN, personId)).thenReturn(List.of(31L));

        assertThatThrownBy(() -> useCase.provision(apprentice(), TOKEN, ADMIN)).isInstanceOf(OnboardingUnavailableException.class);

        verify(provisioning).deleteActor(TOKEN, 31L);
        verify(provisioning, never()).removeRole(anyString(), any(), anyString());
        verify(removeIdentity).removeUserAndPerson(userId, personId);
    }

    @Test
    @DisplayName("A rejected enrollment keeps its status and leaves nothing behind")
    void downstreamRejectionKeepsStatus() {
        when(provisioning.createActor(TOKEN, personId, 1, 4L, "APR-1001")).thenReturn(30L);
        when(provisioning.createEnrollment(TOKEN, 30L, 9L)).thenThrow(new DownstreamRejectedException(403, "other school"));

        assertThatThrownBy(() -> useCase.provision(apprentice(), TOKEN, ADMIN))
                .isInstanceOf(DownstreamRejectedException.class)
                .hasFieldOrPropertyWithValue("status", 403);
        verify(provisioning).deleteActor(TOKEN, 30L);
        verify(removeIdentity).removeUserAndPerson(userId, personId);
    }

    @Test
    @DisplayName("If the user cannot be created, the person created first is removed")
    void userFailureRemovesPerson() {
        doThrow(new IllegalStateException("db")).when(createUser).createUser(any(), anyString());
        when(provisioning.findActorIdsByPerson(TOKEN, personId)).thenReturn(List.of());

        assertThatThrownBy(() -> useCase.provision(apprentice(), TOKEN, ADMIN)).isInstanceOf(IllegalStateException.class);

        verify(removeIdentity).removeUserAndPerson(null, personId);
        verify(provisioning, never()).createActor(anyString(), any(), eq(1), eq(4L), anyString());
    }

    @Test
    @DisplayName("The global role and inconsistent actor data are rejected before anything is created")
    void validatesBeforeCreating() {
        ProvisionUserUseCase.Command superAdmin = new ProvisionUserUseCase.Command(apprentice().person(), "x", "Temporal-2026",
                false, "Super Administrador", new ProvisionUserUseCase.Actor(3, 4L, "ADM", null), CONSENT);
        ProvisionUserUseCase.Command cohortOnInstructor = new ProvisionUserUseCase.Command(apprentice().person(), "x", "Temporal-2026",
                false, "Instructor", new ProvisionUserUseCase.Actor(2, 4L, "INS", 9L), CONSENT);
        ProvisionUserUseCase.Command wrongType = new ProvisionUserUseCase.Command(apprentice().person(), "x", "Temporal-2026",
                false, "Aprendiz", new ProvisionUserUseCase.Actor(2, 4L, "APR", null), CONSENT);

        assertThatThrownBy(() -> useCase.provision(superAdmin, TOKEN, ADMIN)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> useCase.provision(cohortOnInstructor, TOKEN, ADMIN)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> useCase.provision(wrongType, TOKEN, ADMIN)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(createPerson, provisioning, removeIdentity);
    }

    @Test
    @DisplayName("Without an academic actor only identity and the role are created")
    void accountWithoutActor() {
        ProvisionUserUseCase.Command admin = new ProvisionUserUseCase.Command(apprentice().person(), "admin.sede", "Temporal-2026",
                false, "Administrador", null, CONSENT);

        ProvisionUserUseCase.Result result = useCase.provision(admin, TOKEN, ADMIN);

        assertThat(result.academicActorId()).isNull();
        verify(provisioning, never()).createActor(anyString(), any(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyLong(), anyString());
        verify(provisioning).assignRole(TOKEN, userId, "Administrador");
    }

    @Test
    @DisplayName("The holder's acceptance is recorded with the notice version (Ley 1581)")
    void recordsConsent() {
        when(provisioning.createActor(TOKEN, personId, 1, 4L, "APR-1001")).thenReturn(30L);

        useCase.provision(apprentice(), TOKEN, ADMIN);

        verify(consent).recordAssisted(personId, "2026-10", true, ADMIN);
    }

    @Test
    @DisplayName("Without consent, or with an old notice version, nothing is created")
    void requiresCurrentConsent() {
        ProvisionUserUseCase.Command old = new ProvisionUserUseCase.Command(apprentice().person(), "x", "Temporal-2026",
                false, "Aprendiz", null, new ProvisionUserUseCase.Consent("2020-01", false));
        ProvisionUserUseCase.Command none = new ProvisionUserUseCase.Command(apprentice().person(), "x", "Temporal-2026",
                false, "Aprendiz", null, null);

        assertThatThrownBy(() -> useCase.provision(old, TOKEN, ADMIN)).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> useCase.provision(none, TOKEN, ADMIN)).isInstanceOf(ValidationException.class);
        verifyNoInteractions(createPerson, provisioning);
    }
}
