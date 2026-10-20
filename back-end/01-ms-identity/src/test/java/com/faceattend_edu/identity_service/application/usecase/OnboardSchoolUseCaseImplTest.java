package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ChangeUserStatusUseCase;
import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.OnboardSchoolUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByUsernamePort;
import com.faceattend_edu.identity_service.application.port.out.SchoolProvisioningPort;
import com.faceattend_edu.identity_service.config.OnboardingProperties;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.OnboardingUnavailableException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Alta pública de sede + administrador: orden de pasos, pendiente de activación y compensación. */
@ExtendWith(MockitoExtension.class)
@DisplayName("OnboardSchoolUseCaseImpl unit tests")
class OnboardSchoolUseCaseImplTest {

    private static final OnboardSchoolUseCase.School SCHOOL =
            new OnboardSchoolUseCase.School("CIES-009", "Colegio Nuevo", "Bogotá", "Calle 1", "3000000000", "sede@colegio.edu");
    private static final OnboardSchoolUseCase.Admin ADMIN =
            new OnboardSchoolUseCase.Admin("CC", "123456", "Ana", "Pérez", "ana@colegio.edu", "3111111111", "ana.perez", "Secret123!");

    @Mock CreateUserSessionUseCase createUserSessionUseCase;
    @Mock CloseUserSessionUseCase closeUserSessionUseCase;
    @Mock CreatePersonUseCase createPersonUseCase;
    @Mock CreateUserUseCase createUserUseCase;
    @Mock ChangeUserStatusUseCase changeUserStatusUseCase;
    @Mock LoadUserByUsernamePort loadUserByUsernamePort;
    @Mock SchoolProvisioningPort provisioning;

    private OnboardingProperties properties;
    private OnboardSchoolUseCaseImpl useCase;
    private UUID serviceUserId;
    private UserSession session;
    private String token;
    private Person person;
    private User user;

    @BeforeEach
    void setUp() {
        serviceUserId = UUID.randomUUID();
        properties = new OnboardingProperties();
        properties.setServiceUserId(serviceUserId.toString());
        useCase = new OnboardSchoolUseCaseImpl(properties, createUserSessionUseCase, closeUserSessionUseCase,
                createPersonUseCase, createUserUseCase, changeUserStatusUseCase, loadUserByUsernamePort, provisioning);

        session = new UserSession();
        session.setSessionId(UUID.randomUUID());
        token = session.getSessionId().toString();

        person = new Person();
        person.setPersonId(UUID.randomUUID());
        user = new User();
        user.setUserId(UUID.randomUUID());
    }

    private void stubOpenSession() {
        when(createUserSessionUseCase.createSession(serviceUserId, "onboarding")).thenReturn(session);
    }

    private void stubIdentityRows() {
        when(createPersonUseCase.createPerson(any(Person.class))).thenReturn(person);
        when(createUserUseCase.createUser(any(User.class), eq("Secret123!"))).thenReturn(user);
    }

    @Test
    @DisplayName("is unavailable when no service account is configured")
    void disabledWithoutServiceAccount() {
        properties.setServiceUserId("");

        assertThatThrownBy(() -> useCase.onboard(SCHOOL, ADMIN)).isInstanceOf(OnboardingUnavailableException.class);

        verifyNoInteractions(createUserSessionUseCase, createPersonUseCase, createUserUseCase, provisioning);
    }

    @Test
    @DisplayName("rejects a taken username before opening any session")
    void rejectsDuplicateUsername() {
        when(loadUserByUsernamePort.loadUserByUsername("ana.perez")).thenReturn(new User());

        assertThatThrownBy(() -> useCase.onboard(SCHOOL, ADMIN)).isInstanceOf(DuplicateEntityException.class);

        verifyNoInteractions(createUserSessionUseCase, createPersonUseCase, provisioning);
    }

    @Test
    @DisplayName("rejects a taken school code without creating identity rows and closes the session")
    void rejectsDuplicateSchoolCode() {
        stubOpenSession();
        when(provisioning.schoolCodeExists(token, "CIES-009")).thenReturn(true);

        assertThatThrownBy(() -> useCase.onboard(SCHOOL, ADMIN)).isInstanceOf(DuplicateEntityException.class);

        verify(createPersonUseCase, never()).createPerson(any());
        verify(closeUserSessionUseCase).closeSession(session.getSessionId());
    }

    @Test
    @DisplayName("creates person and inactive user, then school, role and link, and closes the session")
    void happyPath() {
        stubOpenSession();
        stubIdentityRows();
        when(provisioning.schoolCodeExists(token, "CIES-009")).thenReturn(false);
        when(provisioning.createSchool(token, SCHOOL)).thenReturn(7L);
        when(provisioning.linkAdminToSchool(eq(token), eq(person.getPersonId()), eq(7L), anyString())).thenReturn(11L);

        OnboardSchoolUseCase.Result result = useCase.onboard(SCHOOL, ADMIN);

        assertThat(result.schoolId()).isEqualTo(7L);
        assertThat(result.personId()).isEqualTo(person.getPersonId());
        assertThat(result.userId()).isEqualTo(user.getUserId());
        InOrder order = inOrder(createPersonUseCase, createUserUseCase, changeUserStatusUseCase, provisioning, closeUserSessionUseCase);
        order.verify(createPersonUseCase).createPerson(any(Person.class));
        order.verify(createUserUseCase).createUser(any(User.class), eq("Secret123!"));
        order.verify(changeUserStatusUseCase).changeStatus(user.getUserId(), false);
        order.verify(provisioning).createSchool(token, SCHOOL);
        order.verify(provisioning).assignAdminRole(token, user.getUserId());
        order.verify(provisioning).linkAdminToSchool(token, person.getPersonId(), 7L, "ADM-CIES-009");
        order.verify(closeUserSessionUseCase).closeSession(session.getSessionId());
    }

    @Test
    @DisplayName("removes the school and the role when linking the administrator fails")
    void rollsBackWhenLinkFails() {
        stubOpenSession();
        stubIdentityRows();
        when(provisioning.schoolCodeExists(token, "CIES-009")).thenReturn(false);
        when(provisioning.createSchool(token, SCHOOL)).thenReturn(7L);
        when(provisioning.linkAdminToSchool(eq(token), any(UUID.class), anyLong(), anyString()))
                .thenThrow(new OnboardingUnavailableException("academic down"));

        assertThatThrownBy(() -> useCase.onboard(SCHOOL, ADMIN)).isInstanceOf(OnboardingUnavailableException.class);

        verify(provisioning).removeAdminRole(token, user.getUserId());
        verify(provisioning).deleteSchool(token, 7L);
        verify(provisioning, never()).deleteActor(anyString(), anyLong());
        verify(closeUserSessionUseCase).closeSession(session.getSessionId());
    }

    @Test
    @DisplayName("removes only the school when assigning the role fails")
    void rollsBackSchoolWhenRoleFails() {
        stubOpenSession();
        stubIdentityRows();
        when(provisioning.schoolCodeExists(token, "CIES-009")).thenReturn(false);
        when(provisioning.createSchool(token, SCHOOL)).thenReturn(7L);
        org.mockito.Mockito.doThrow(new OnboardingUnavailableException("authorization down"))
                .when(provisioning).assignAdminRole(token, user.getUserId());

        assertThatThrownBy(() -> useCase.onboard(SCHOOL, ADMIN)).isInstanceOf(OnboardingUnavailableException.class);

        verify(provisioning).deleteSchool(token, 7L);
        verify(provisioning, never()).removeAdminRole(anyString(), any(UUID.class));
        verify(closeUserSessionUseCase).closeSession(session.getSessionId());
    }
}
