package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.SavePersonPort;
import com.faceattend_edu.identity_service.domain.model.Person;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Alta de persona: la validación de dominio (Person.validate) decide qué llega a persistir. */
@ExtendWith(MockitoExtension.class)
@DisplayName("CreatePersonUseCaseImpl unit tests")
class CreatePersonUseCaseImplTest {

    @Mock SavePersonPort savePersonPort;

    private CreatePersonUseCaseImpl useCase;

    @BeforeEach
    void setUp() {
        useCase = new CreatePersonUseCaseImpl(savePersonPort);
    }

    private Person validPerson() {
        Person person = new Person();
        person.setDocumentNumber("1098765432");
        person.setName("Carolina");
        person.setLastName("Mendoza");
        person.setEmail("carolina.mendoza@example.com");
        person.setDocumentType("CC");
        return person;
    }

    @Test
    @DisplayName("givenValidPerson_whenCreatePerson_thenActivatesAndSaves")
    void givenValidPerson_whenCreatePerson_thenActivatesAndSaves() {
        // Arrange
        when(savePersonPort.savePerson(any(Person.class))).thenAnswer(call -> call.getArgument(0));

        // Act
        Person created = useCase.createPerson(validPerson());

        // Assert
        assertThat(created.getStatus()).isTrue();
        assertThat(created.getCreatedAt()).isNotNull();
        verify(savePersonPort).savePerson(created);
    }

    @ParameterizedTest(name = "[{index}] {1}")
    @MethodSource("invalidPersons")
    @DisplayName("givenInvalidField_whenCreatePerson_thenIllegalArgumentExceptionAndNeverSaves")
    void givenInvalidField_whenCreatePerson_thenIllegalArgumentExceptionAndNeverSaves(
            Person person, String description) {
        assertThatThrownBy(() -> useCase.createPerson(person))
                .isInstanceOf(IllegalArgumentException.class);
        verify(savePersonPort, never()).savePerson(any());
    }

    static Stream<Arguments> invalidPersons() {
        return Stream.of(
                Arguments.of(withDocumentNumber(null), "documentNumber null"),
                Arguments.of(withDocumentNumber("   "), "documentNumber blank"),
                Arguments.of(withName("   "), "name blank"),
                Arguments.of(withLastName("  "), "lastName blank"),
                Arguments.of(withEmail("not-an-email"), "email with invalid format"),
                Arguments.of(withDocumentNumber("9".repeat(51)), "documentNumber over 50 chars"));
    }

    private static Person withDocumentNumber(String documentNumber) {
        Person person = new Person();
        person.setDocumentNumber(documentNumber);
        person.setName("Carolina");
        person.setLastName("Mendoza");
        return person;
    }

    private static Person withName(String name) {
        Person person = withDocumentNumber("1098765432");
        person.setName(name);
        return person;
    }

    private static Person withLastName(String lastName) {
        Person person = withDocumentNumber("1098765432");
        person.setLastName(lastName);
        return person;
    }

    private static Person withEmail(String email) {
        Person person = withDocumentNumber("1098765432");
        person.setEmail(email);
        return person;
    }
}
