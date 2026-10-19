package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByUsernamePort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserPort;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Alta de usuario: hashing de la credencial, unicidad de username y existencia de la persona. */
@ExtendWith(MockitoExtension.class)
@DisplayName("CreateUserUseCaseImpl unit tests")
class CreateUserUseCaseImplTest {

    private static final String RAW_PASSWORD = "Secret123";
    private static final String HASHED = "$2a$10$hashedSecret123";

    @Mock SaveUserPort saveUserPort;
    @Mock LoadPersonPort loadPersonPort;
    @Mock LoadUserByUsernamePort loadUserByUsernamePort;
    @Mock HashPasswordPort hashPasswordPort;

    private CreateUserUseCaseImpl useCase;
    private UUID personId;

    @BeforeEach
    void setUp() {
        useCase = new CreateUserUseCaseImpl(
                saveUserPort, loadPersonPort, loadUserByUsernamePort, hashPasswordPort);
        personId = UUID.randomUUID();
    }

    private User userWithPerson(UUID id) {
        Person person = new Person();
        person.setPersonId(id);
        User user = new User();
        user.setPersonId(person);
        user.setUsername("carolina.mendoza");
        return user;
    }

    private void existingPerson() {
        Person person = new Person();
        person.setPersonId(personId);
        person.setStatus(true);
        when(loadPersonPort.loadPerson(personId)).thenReturn(person);
    }

    @Test
    @DisplayName("givenValidUser_whenCreateUser_thenHashesPasswordAndSaves")
    void givenValidUser_whenCreateUser_thenHashesPasswordAndSaves() {
        // Arrange
        existingPerson();
        when(hashPasswordPort.hash(RAW_PASSWORD)).thenReturn(HASHED);
        when(loadUserByUsernamePort.loadUserByUsername("carolina.mendoza")).thenReturn(null);
        when(saveUserPort.saveUser(any(User.class))).thenAnswer(call -> call.getArgument(0));

        // Act
        User created = useCase.createUser(userWithPerson(personId), RAW_PASSWORD);

        // Assert
        assertThat(created.getPasswordHash()).isEqualTo(HASHED);
        assertThat(created.getAuthenticationType()).isEqualTo(User.DEFAULT_AUTHENTICATION_TYPE);
        assertThat(created.getStatus()).isTrue();
        assertThat(created.getCreatedAt()).isNotNull();
        verify(saveUserPort).saveUser(created);
    }

    @Test
    @DisplayName("givenNullUser_whenCreateUser_thenIllegalArgumentException")
    void givenNullUser_whenCreateUser_thenIllegalArgumentException() {
        assertThatThrownBy(() -> useCase.createUser(null, RAW_PASSWORD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User.personId is required");
        verify(saveUserPort, never()).saveUser(any());
    }

    @Test
    @DisplayName("givenUserWithoutPersonId_whenCreateUser_thenIllegalArgumentException")
    void givenUserWithoutPersonId_whenCreateUser_thenIllegalArgumentException() {
        // Arrange: sin aggregate y con person sin identificador
        User withoutPerson = new User();
        withoutPerson.setUsername("carolina.mendoza");

        // Act & Assert
        assertThatThrownBy(() -> useCase.createUser(withoutPerson, RAW_PASSWORD))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> useCase.createUser(userWithPerson(null), RAW_PASSWORD))
                .isInstanceOf(IllegalArgumentException.class);
        verify(saveUserPort, never()).saveUser(any());
    }

    @Test
    @DisplayName("givenBlankRawPassword_whenCreateUser_thenIllegalArgumentException")
    void givenBlankRawPassword_whenCreateUser_thenIllegalArgumentException() {
        assertThatThrownBy(() -> useCase.createUser(userWithPerson(personId), "   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User.password is required");
        verify(saveUserPort, never()).saveUser(any());
    }

    @Test
    @DisplayName("givenUnknownPerson_whenCreateUser_thenEntityNotFoundAndNeverSaves")
    void givenUnknownPerson_whenCreateUser_thenEntityNotFoundAndNeverSaves() {
        // Arrange: la persona no existe en Identity
        when(loadPersonPort.loadPerson(personId)).thenReturn(null);

        // Act & Assert
        assertThatThrownBy(() -> useCase.createUser(userWithPerson(personId), RAW_PASSWORD))
                .isInstanceOfSatisfying(EntityNotFoundException.class, ex -> {
                    assertThat(ex.getEntityName()).isEqualTo("Person");
                    assertThat(ex.getIdentifier()).isEqualTo(personId);
                    assertThat(ex.getMessage()).isEqualTo("Person not found with identifier=" + personId);
                });
        verify(saveUserPort, never()).saveUser(any());
    }

    @Test
    @DisplayName("givenDuplicatedUsername_whenCreateUser_thenDuplicateEntityAndNeverSaves")
    void givenDuplicatedUsername_whenCreateUser_thenDuplicateEntityAndNeverSaves() {
        // Arrange: mismo username en otra cuenta
        existingPerson();
        when(hashPasswordPort.hash(RAW_PASSWORD)).thenReturn(HASHED);
        when(loadUserByUsernamePort.loadUserByUsername("carolina.mendoza")).thenReturn(new User());

        // Act & Assert
        assertThatThrownBy(() -> useCase.createUser(userWithPerson(personId), RAW_PASSWORD))
                .isInstanceOfSatisfying(DuplicateEntityException.class, ex -> {
                    assertThat(ex.getEntityName()).isEqualTo("User");
                    assertThat(ex.getDuplicateValue()).isEqualTo("carolina.mendoza");
                });
        verify(saveUserPort, never()).saveUser(any());
    }

    @Test
    @DisplayName("givenUnsupportedAuthenticationType_whenCreateUser_thenIllegalArgumentException")
    void givenUnsupportedAuthenticationType_whenCreateUser_thenIllegalArgumentException() {
        // Arrange: User.validate() solo admite Local/Windows/External
        existingPerson();
        when(hashPasswordPort.hash(RAW_PASSWORD)).thenReturn(HASHED);
        User user = userWithPerson(personId);
        user.setAuthenticationType("Magic");

        // Act & Assert
        assertThatThrownBy(() -> useCase.createUser(user, RAW_PASSWORD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User.authenticationType is not supported");
        verify(saveUserPort, never()).saveUser(any());
    }
}
