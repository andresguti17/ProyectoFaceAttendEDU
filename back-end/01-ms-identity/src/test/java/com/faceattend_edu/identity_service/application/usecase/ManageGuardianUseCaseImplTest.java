package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ManageGuardianUseCase.GuardianData;
import com.faceattend_edu.identity_service.application.port.out.GuardianPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.PersonSchoolPort;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import com.faceattend_edu.identity_service.domain.model.Person;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("Guardian of a minor learner")
class ManageGuardianUseCaseImplTest {

    private static final List<String> ADMIN = List.of("Administrador");

    @Mock GuardianPort guardianPort;
    @Mock LoadPersonPort loadPersonPort;
    @Mock PersonSchoolPort personSchoolPort;
    @InjectMocks ManageGuardianUseCaseImpl useCase;

    private final UUID minorId = UUID.randomUUID();
    private final UUID adultId = UUID.randomUUID();
    private final UUID admin = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        lenient().when(loadPersonPort.loadPerson(minorId)).thenReturn(person(minorId, LocalDate.now().minusYears(14), "TI", "1001"));
        lenient().when(loadPersonPort.loadPerson(adultId)).thenReturn(person(adultId, LocalDate.now().minusYears(30), "CC", "2002"));
        lenient().when(personSchoolPort.schoolOf(any(), any())).thenReturn(Optional.of(3L));
        lenient().when(guardianPort.findActiveByMinor(any())).thenReturn(Optional.empty());
        lenient().when(guardianPort.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void anAdministratorRegistersAndLinksAGuardianToAMinor() {
        Guardian saved = useCase.register(minorId, data("CC", "5005"), admin, ADMIN, "token");

        assertThat(saved.getMinorPersonId()).isEqualTo(minorId);
        assertThat(saved.getSchoolId()).isEqualTo(3L);
        assertThat(saved.getCreatedBy()).isEqualTo(admin);
        assertThat(saved.getDocumentType()).isEqualTo("CC");
    }

    @Test
    void onlyAdministratorsManageGuardians() {
        assertThatThrownBy(() -> useCase.register(minorId, data("CC", "5005"), admin, List.of("Instructor"), "token"))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> useCase.find(minorId, List.of("Aprendiz"))).isInstanceOf(ForbiddenException.class);
        verify(guardianPort, never()).save(any());
    }

    @Test
    void aGuardianCannotBeRegisteredForAnAdult() {
        assertThatThrownBy(() -> useCase.register(adultId, data("CC", "5005"), admin, ADMIN, "token"))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("minor");
    }

    @Test
    void aMinorHasOnlyOneActiveGuardian() {
        lenient().when(guardianPort.findActiveByMinor(minorId)).thenReturn(Optional.of(existing("CC", "5005")));

        assertThatThrownBy(() -> useCase.register(minorId, data("CC", "6006"), admin, ADMIN, "token"))
                .isInstanceOf(DuplicateEntityException.class);
    }

    @Test
    void theGuardianNeedsContactDataAndAnAdultDocument() {
        assertThatThrownBy(() -> useCase.register(minorId, new GuardianData("Ana Gómez", "CC", "5005", null, " ", "Madre"), admin, ADMIN, "t"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("e-mail or a phone");
        assertThatThrownBy(() -> useCase.register(minorId, data("TI", "5005"), admin, ADMIN, "t"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("document type");
        assertThatThrownBy(() -> useCase.register(minorId, new GuardianData("Ana Gómez", "CC", "5005", "no-es-correo", null, "Madre"), admin, ADMIN, "t"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("e-mail");
    }

    @Test
    void theMinorCannotBeTheirOwnGuardian() {
        assertThatThrownBy(() -> useCase.register(minorId, data("CC", "1001"), admin, ADMIN, "t"))
                .isInstanceOf(ValidationException.class).hasMessageContaining("cannot be the minor");
    }

    @Test
    void editingTheSameGuardianKeepsTheirIdentity() {
        Guardian current = existing("CC", "5005");
        lenient().when(guardianPort.findActiveByMinor(minorId)).thenReturn(Optional.of(current));

        Guardian saved = useCase.update(minorId, new GuardianData("Ana María Gómez", "CC", "5005", "ana@correo.co", "3001234567", "Madre"), admin, ADMIN, "t");

        assertThat(saved.getGuardianId()).isEqualTo(current.getGuardianId());
        assertThat(saved.getFullName()).isEqualTo("Ana María Gómez");
        assertThat(saved.getUpdatedBy()).isEqualTo(admin);
        verify(guardianPort, never()).remove(any(), any());
    }

    @Test
    void anotherDocumentReplacesTheGuardianAndRetiresThePreviousOne() {
        Guardian current = existing("CC", "5005");
        lenient().when(guardianPort.findActiveByMinor(minorId)).thenReturn(Optional.of(current));

        Guardian saved = useCase.update(minorId, data("CE", "9009"), admin, ADMIN, "t");

        assertThat(saved.getGuardianId()).isNotEqualTo(current.getGuardianId());
        ArgumentCaptor<UUID> removed = ArgumentCaptor.forClass(UUID.class);
        verify(guardianPort).remove(removed.capture(), any());
        assertThat(removed.getValue()).isEqualTo(current.getGuardianId());
    }

    @Test
    void editingAMinorWithoutGuardianIsNotFound() {
        assertThatThrownBy(() -> useCase.update(minorId, data("CC", "5005"), admin, ADMIN, "t"))
                .isInstanceOf(EntityNotFoundException.class);
    }

    private static GuardianData data(String type, String number) {
        return new GuardianData("Ana Gómez", type, number, "ana@correo.co", "3001234567", "Madre");
    }

    private Guardian existing(String type, String number) {
        Guardian g = new Guardian();
        g.setGuardianId(UUID.randomUUID());
        g.setMinorPersonId(minorId);
        g.setDocumentType(type);
        g.setDocumentNumber(number);
        return g;
    }

    private static Person person(UUID id, LocalDate birth, String type, String number) {
        Person p = new Person();
        p.setPersonId(id);
        p.setBirthDate(birth);
        p.setDocumentType(type);
        p.setDocumentNumber(number);
        return p;
    }
}
