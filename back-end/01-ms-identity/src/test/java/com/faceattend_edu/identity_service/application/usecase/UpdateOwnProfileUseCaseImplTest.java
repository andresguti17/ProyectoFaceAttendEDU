package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.UpdateOwnProfileUseCase.ProfileChanges;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdatePersonPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.BloodType;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Perfil propio: solo cambian los campos editables y el correo exige la contraseña actual. */
@ExtendWith(MockitoExtension.class)
@DisplayName("UpdateOwnProfileUseCaseImpl unit tests")
class UpdateOwnProfileUseCaseImplTest {

    @Mock LoadUserPort loadUserPort;
    @Mock LoadPersonPort loadPersonPort;
    @Mock UpdatePersonPort updatePersonPort;
    @Mock HashPasswordPort hashPasswordPort;

    private UpdateOwnProfileUseCaseImpl useCase;
    private UUID userId;
    private Person person;
    private User user;

    @BeforeEach
    void setUp() {
        useCase = new UpdateOwnProfileUseCaseImpl(loadUserPort, loadPersonPort, updatePersonPort, hashPasswordPort);
        userId = UUID.randomUUID();
        person = new Person();
        person.setPersonId(UUID.randomUUID());
        person.setDocumentType("CC");
        person.setDocumentNumber("1234567");
        person.setName("Ana");
        person.setLastName("Pérez");
        person.setEmail("ana@colegio.edu");
        person.setPhone("3000000000");
        person.setAddress("Calle 1");
        person.setStatus(true);
        Person reference = new Person();
        reference.setPersonId(person.getPersonId());
        user = new User();
        user.setUserId(userId);
        user.setPersonId(reference);
        user.setPasswordHash("hash:Secret123!");
        // lenient: the "unknown user" test never reaches the person lookup
        lenient().when(loadUserPort.loadUser(userId)).thenReturn(user);
        lenient().when(loadPersonPort.loadPerson(person.getPersonId())).thenReturn(person);
    }

    private ProfileChanges changes(String phone, String address, LocalDate birth, String blood, String email, String current) {
        return new ProfileChanges(phone, address, birth, blood, email, current);
    }

    @Test
    @DisplayName("replaces the editable fields and leaves names, document and status untouched")
    void editableFieldsOnly() {
        Person saved = useCase.updateProfile(userId,
                changes("3111111111", "Carrera 7", LocalDate.of(2000, 5, 17), "O+", null, null));

        assertThat(saved.getPhone()).isEqualTo("3111111111");
        assertThat(saved.getAddress()).isEqualTo("Carrera 7");
        assertThat(saved.getBirthDate()).isEqualTo(LocalDate.of(2000, 5, 17));
        assertThat(saved.getBloodType()).isEqualTo(BloodType.O_POSITIVE);
        assertThat(saved.getName()).isEqualTo("Ana");
        assertThat(saved.getLastName()).isEqualTo("Pérez");
        assertThat(saved.getDocumentNumber()).isEqualTo("1234567");
        assertThat(saved.getDocumentType()).isEqualTo("CC");
        assertThat(saved.getStatus()).isTrue();
        assertThat(saved.getEmail()).isEqualTo("ana@colegio.edu");
        assertThat(saved.getUpdatedBy()).isEqualTo(userId);
        verify(updatePersonPort).updatePerson(saved);
    }

    @Test
    @DisplayName("blank phone and address clear the fields")
    void blankClears() {
        Person saved = useCase.updateProfile(userId, changes("  ", "", null, "", null, null));

        assertThat(saved.getPhone()).isNull();
        assertThat(saved.getAddress()).isNull();
        assertThat(saved.getBloodType()).isNull();
    }

    @Test
    @DisplayName("an unchanged email (any case) needs no password")
    void sameEmailNoPassword() {
        Person saved = useCase.updateProfile(userId, changes("3000000000", "Calle 1", null, null, "ANA@colegio.edu", null));

        assertThat(saved.getEmail()).isEqualTo("ana@colegio.edu");
        verify(updatePersonPort).updatePerson(saved);
    }

    @Test
    @DisplayName("a new email with the right current password is stored lowercase")
    void newEmailWithPassword() {
        when(hashPasswordPort.matches("Secret123!", "hash:Secret123!")).thenReturn(true);

        Person saved = useCase.updateProfile(userId,
                changes("3000000000", "Calle 1", null, null, " Nueva@Colegio.edu ", "Secret123!"));

        assertThat(saved.getEmail()).isEqualTo("nueva@colegio.edu");
    }

    @Test
    @DisplayName("a new email without or with a wrong password is rejected and nothing is saved")
    void newEmailWrongPassword() {
        when(hashPasswordPort.matches("mala", "hash:Secret123!")).thenReturn(false);

        assertThatThrownBy(() -> useCase.updateProfile(userId,
                changes("3111111111", "Calle 1", null, null, "otra@colegio.edu", "mala")))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("Current password is incorrect");
        assertThatThrownBy(() -> useCase.updateProfile(userId,
                changes("3111111111", "Calle 1", null, null, "otra@colegio.edu", null)))
                .isInstanceOf(ValidationException.class);

        verify(updatePersonPort, never()).updatePerson(person);
        assertThat(person.getEmail()).isEqualTo("ana@colegio.edu");
    }

    @Test
    @DisplayName("rejects a future birth date")
    void futureBirthDate() {
        assertThatThrownBy(() -> useCase.updateProfile(userId,
                changes(null, null, LocalDate.now().plusDays(1), null, null, null)))
                .isInstanceOf(ValidationException.class);
        verify(updatePersonPort, never()).updatePerson(person);
    }

    @Test
    @DisplayName("rejects an unknown blood type")
    void unknownBloodType() {
        assertThatThrownBy(() -> useCase.updateProfile(userId, changes(null, null, null, "Z+", null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(updatePersonPort, never()).updatePerson(person);
    }

    @Test
    @DisplayName("fails with not found when the session user does not exist")
    void unknownUser() {
        UUID other = UUID.randomUUID();
        when(loadUserPort.loadUser(other)).thenReturn(null);

        assertThatThrownBy(() -> useCase.updateProfile(other, changes(null, null, null, null, null, null)))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    @DisplayName("persists exactly the person that was loaded")
    void savesLoadedPerson() {
        useCase.updateProfile(userId, changes("3111111111", "Calle 1", null, null, null, null));

        ArgumentCaptor<Person> captor = ArgumentCaptor.forClass(Person.class);
        verify(updatePersonPort).updatePerson(captor.capture());
        assertThat(captor.getValue()).isSameAs(person);
    }
}
