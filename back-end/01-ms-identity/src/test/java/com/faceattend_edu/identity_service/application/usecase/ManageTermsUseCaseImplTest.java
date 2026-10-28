package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.GuardianPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.PersonSchoolPort;
import com.faceattend_edu.identity_service.application.port.out.TermsAcceptancePort;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Enablement;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.TermsAcceptance;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
@DisplayName("Terms and Conditions: enablement by age")
class ManageTermsUseCaseImplTest {

    private static final String VERSION = "2026-10";
    private static final List<String> LEARNER = List.of("Aprendiz");
    private static final List<String> ADMIN = List.of("Administrador");

    @Mock TermsAcceptancePort termsPort;
    @Mock GuardianPort guardianPort;
    @Mock LoadPersonPort loadPersonPort;
    @Mock LoadUserPort loadUserPort;
    @Mock PersonSchoolPort personSchoolPort;
    @InjectMocks ManageTermsUseCaseImpl useCase;

    private final UUID adultPerson = UUID.randomUUID();
    private final UUID adultUser = UUID.randomUUID();
    private final UUID minorPerson = UUID.randomUUID();
    private final UUID minorUser = UUID.randomUUID();
    private final UUID adminUser = UUID.randomUUID();
    private final UUID guardianId = UUID.randomUUID();

    private TermsAcceptance stored;

    @BeforeEach
    void setUp() {
        lenient().when(loadPersonPort.loadPerson(adultPerson)).thenReturn(person(adultPerson, LocalDate.now().minusYears(25), "CC"));
        lenient().when(loadPersonPort.loadPerson(minorPerson)).thenReturn(person(minorPerson, LocalDate.now().minusYears(15), "TI"));
        lenient().when(loadUserPort.loadUser(adultUser)).thenReturn(user(adultPerson));
        lenient().when(loadUserPort.loadUser(minorUser)).thenReturn(user(minorPerson));
        lenient().when(loadUserPort.loadUser(adminUser)).thenReturn(user(UUID.randomUUID()));
        lenient().when(personSchoolPort.schoolOf(any(), any())).thenReturn(Optional.of(7L));
        lenient().when(guardianPort.findActiveByMinor(any())).thenReturn(Optional.empty());
        lenient().when(termsPort.findCurrent(any())).thenAnswer(call -> Optional.ofNullable(stored));
        lenient().when(termsPort.save(any())).thenAnswer(call -> stored = call.getArgument(0));
    }

    @Test
    void anAdultWithoutAcceptanceIsPendingTheTerms() {
        Enablement result = useCase.enablement(adultPerson, adultUser);

        assertThat(result.minor()).isFalse();
        assertThat(result.status()).isEqualTo(Enablement.Status.TERMS_PENDING);
    }

    @Test
    void anAdultAcceptsOnTheFirstLoginAndIsAskedOnlyOnce() {
        Enablement first = useCase.accept(adultPerson, VERSION, adultUser, LEARNER, "token");
        Enablement second = useCase.accept(adultPerson, VERSION, adultUser, LEARNER, "token");

        assertThat(first.enabled()).isTrue();
        assertThat(second.enabled()).isTrue();
        ArgumentCaptor<TermsAcceptance> saved = ArgumentCaptor.forClass(TermsAcceptance.class);
        verify(termsPort).save(saved.capture());
        assertThat(saved.getValue().getUserType()).isEqualTo(TermsAcceptance.ADULT);
        assertThat(saved.getValue().getAcceptedBy()).isEqualTo(TermsAcceptance.BY_SELF);
        assertThat(saved.getValue().getTermsVersion()).isEqualTo(VERSION);
        assertThat(saved.getValue().getSchoolId()).isEqualTo(7L);
        assertThat(saved.getValue().getAcceptedAt()).isNotNull();
    }

    @Test
    void aNewVersionOfTheTermsAsksTheAdultAgain() {
        stored = acceptance(adultPerson, "2025-01", null, TermsAcceptance.ADULT);

        Enablement result = useCase.enablement(adultPerson, adultUser);

        assertThat(result.termsAccepted()).isTrue();
        assertThat(result.termsUpToDate()).isFalse();
        assertThat(result.status()).isEqualTo(Enablement.Status.TERMS_PENDING);
    }

    @Test
    void anAdultCannotHaveTheirTermsAcceptedByAnAdministrator() {
        assertThatThrownBy(() -> useCase.accept(adultPerson, VERSION, adminUser, ADMIN, "token"))
                .isInstanceOf(ForbiddenException.class);
        verify(termsPort, never()).save(any());
    }

    @Test
    void aMinorWithoutGuardianIsBlockedAndPendingTheGuardian() {
        Enablement result = useCase.enablement(minorPerson, minorUser);

        assertThat(result.minor()).isTrue();
        assertThat(result.guardianRegistered()).isFalse();
        assertThat(result.status()).isEqualTo(Enablement.Status.GUARDIAN_PENDING);
        assertThat(result.enabled()).isFalse();
    }

    @Test
    void aMinorWithoutBirthDateButWithTiIsTreatedAsMinor() {
        UUID noBirth = UUID.randomUUID();
        lenient().when(loadPersonPort.loadPerson(noBirth)).thenReturn(person(noBirth, null, "TI"));

        assertThat(useCase.enablement(noBirth, adminUser).minor()).isTrue();
    }

    @Test
    void aMinorCannotAcceptTheirOwnTerms() {
        withGuardian();

        assertThatThrownBy(() -> useCase.accept(minorPerson, VERSION, minorUser, LEARNER, "token"))
                .isInstanceOf(ForbiddenException.class);
        verify(termsPort, never()).save(any());
    }

    @Test
    void anAdministratorCannotRecordTheTermsOfAMinorWithoutGuardian() {
        assertThatThrownBy(() -> useCase.accept(minorPerson, VERSION, adminUser, ADMIN, "token"))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("guardian");
        verify(termsPort, never()).save(any());
    }

    @Test
    void aMinorWithGuardianAndPendingTermsIsPendingTheTerms() {
        withGuardian();

        Enablement result = useCase.enablement(minorPerson, minorUser);

        assertThat(result.guardianRegistered()).isTrue();
        assertThat(result.status()).isEqualTo(Enablement.Status.TERMS_PENDING);
    }

    @Test
    void theAdministratorRecordsTheGuardianAcceptanceAndTheMinorIsFullyEnabled() {
        withGuardian();

        Enablement result = useCase.accept(minorPerson, VERSION, adminUser, ADMIN, "token");

        assertThat(result.status()).isEqualTo(Enablement.Status.ENABLED);
        ArgumentCaptor<TermsAcceptance> saved = ArgumentCaptor.forClass(TermsAcceptance.class);
        verify(termsPort).save(saved.capture());
        TermsAcceptance row = saved.getValue();
        assertThat(row.getUserType()).isEqualTo(TermsAcceptance.MINOR);
        assertThat(row.getAcceptedBy()).isEqualTo(TermsAcceptance.BY_GUARDIAN);
        assertThat(row.getGuardianId()).isEqualTo(guardianId);
        assertThat(row.getRecordedBy()).isEqualTo(adminUser);
        assertThat(row.getSchoolId()).isEqualTo(7L);
    }

    @Test
    void replacingTheGuardianInvalidatesTheTermsAcceptedByThePreviousOne() {
        withGuardian();
        stored = acceptance(minorPerson, VERSION, UUID.randomUUID(), TermsAcceptance.MINOR);

        Enablement result = useCase.enablement(minorPerson, minorUser);

        assertThat(result.termsUpToDate()).isFalse();
        assertThat(result.status()).isEqualTo(Enablement.Status.TERMS_PENDING);
    }

    @Test
    void aMinorWhoseGuardianHasNoSignedDocumentIsPendingTheDocumentBeforeTheTerms() {
        withGuardian(false);

        Enablement result = useCase.enablement(minorPerson, minorUser);

        assertThat(result.guardianRegistered()).isTrue();
        assertThat(result.status()).isEqualTo(Enablement.Status.DOCUMENT_PENDING);
        assertThat(result.enabled()).isFalse();
    }

    @Test
    void acceptedTermsDoNotEnableAMinorWithoutTheSignedDocument() {
        withGuardian(false);
        stored = acceptance(minorPerson, VERSION, guardianId, TermsAcceptance.MINOR);

        assertThat(useCase.enablement(minorPerson, minorUser).status()).isEqualTo(Enablement.Status.DOCUMENT_PENDING);
    }

    @Test
    void theDocumentRequirementCanBeSwitchedOffToStageARollout() {
        withGuardian(false);
        org.springframework.test.util.ReflectionTestUtils.setField(useCase, "documentRequired", false);

        assertThat(useCase.enablement(minorPerson, minorUser).status()).isEqualTo(Enablement.Status.TERMS_PENDING);
    }

    @Test
    void anAdultNeverNeedsAGuardianDocument() {
        assertThat(useCase.enablement(adultPerson, adultUser).status()).isEqualTo(Enablement.Status.TERMS_PENDING);
    }

    @Test
    void onlyTheVersionInForceCanBeAccepted() {
        assertThatThrownBy(() -> useCase.accept(adultPerson, "1999-01", adultUser, LEARNER, "token"))
                .isInstanceOf(ValidationException.class);
        verify(termsPort, never()).save(any());
    }

    private void withGuardian() {
        withGuardian(true);
    }

    private void withGuardian(boolean signedDocument) {
        Guardian guardian = new Guardian();
        guardian.setGuardianId(guardianId);
        guardian.setMinorPersonId(minorPerson);
        if (signedDocument) guardian.setConsentDocumentUri("guardian-documents/2026/10/a.pdf");
        lenient().when(guardianPort.findActiveByMinor(minorPerson)).thenReturn(Optional.of(guardian));
    }

    private static Person person(UUID id, LocalDate birthDate, String documentType) {
        Person person = new Person();
        person.setPersonId(id);
        person.setBirthDate(birthDate);
        person.setDocumentType(documentType);
        return person;
    }

    private static User user(UUID personId) {
        Person person = new Person();
        person.setPersonId(personId);
        User user = new User();
        user.setPersonId(person);
        return user;
    }

    private static TermsAcceptance acceptance(UUID personId, String version, UUID guardian, String type) {
        TermsAcceptance a = new TermsAcceptance();
        a.setPersonId(personId);
        a.setTermsVersion(version);
        a.setGuardianId(guardian);
        a.setUserType(type);
        a.setAcceptedAt(LocalDateTime.now().minusDays(1));
        return a;
    }
}
