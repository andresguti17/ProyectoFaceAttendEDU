package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.out.ConsentPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.DataProcessingConsent;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Ley 1581: data-processing authorization")
class ManageConsentUseCaseImplTest {

    @Mock ConsentPort consentPort;
    @Mock LoadUserPort loadUserPort;
    @InjectMocks ManageConsentUseCaseImpl useCase;

    private final UUID holderPerson = UUID.randomUUID();
    private final UUID holderUser = UUID.randomUUID();
    private final UUID otherUser = UUID.randomUUID();

    @BeforeEach
    void users() {
        Person person = new Person();
        person.setPersonId(holderPerson);
        User holder = new User();
        holder.setUserId(holderUser);
        holder.setPersonId(person);
        lenient().when(loadUserPort.loadUser(holderUser)).thenReturn(holder);
        lenient().when(loadUserPort.loadUser(otherUser)).thenReturn(new User());
        lenient().when(consentPort.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void theHolderAcceptsForThemselfWithDateAndVersion() {
        DataProcessingConsent saved = useCase.accept(holderPerson, "2026-10", true, holderUser, List.of("Aprendiz"));

        assertThat(saved.getChannel()).isEqualTo(DataProcessingConsent.SELF);
        assertThat(saved.getPolicyVersion()).isEqualTo("2026-10");
        assertThat(saved.getAcceptedAt()).isNotNull();
        assertThat(saved.biometricAuthorized()).isTrue();
    }

    @Test
    void anAdministratorRecordsItAsAssisted() {
        DataProcessingConsent saved = useCase.accept(holderPerson, "2026-10", false, otherUser, List.of("Administrador"));

        assertThat(saved.getChannel()).isEqualTo(DataProcessingConsent.ASSISTED);
        assertThat(saved.getRecordedBy()).isEqualTo(otherUser);
        assertThat(saved.biometricAuthorized()).isFalse();
    }

    @Test
    void someoneElseWithoutAdministrationIsRefused() {
        assertThatThrownBy(() -> useCase.accept(holderPerson, "2026-10", true, otherUser, List.of("Instructor")))
                .isInstanceOf(ForbiddenException.class);
        verify(consentPort, never()).save(any());
    }

    @Test
    void onlyTheNoticeInForceCanBeAccepted() {
        assertThatThrownBy(() -> useCase.accept(holderPerson, "2019-01", true, holderUser, List.of()))
                .isInstanceOf(ValidationException.class);
    }

    @Test
    void revokingTheBiometricPartKeepsTheRestAndIsIdempotent() {
        DataProcessingConsent current = new DataProcessingConsent(UUID.randomUUID(), holderPerson, "2026-10",
                LocalDateTime.now().minusDays(1), true, null, DataProcessingConsent.SELF, holderUser);
        when(consentPort.findCurrent(holderPerson)).thenReturn(Optional.of(current));

        DataProcessingConsent revoked = useCase.revokeBiometric(holderPerson, holderUser, List.of());
        LocalDateTime first = revoked.getBiometricRevokedAt();
        useCase.revokeBiometric(holderPerson, holderUser, List.of());

        assertThat(revoked.biometricAuthorized()).isFalse();
        assertThat(revoked.getPolicyVersion()).isEqualTo("2026-10");
        ArgumentCaptor<DataProcessingConsent> saved = ArgumentCaptor.forClass(DataProcessingConsent.class);
        verify(consentPort).save(saved.capture());
        assertThat(saved.getValue().getBiometricRevokedAt()).isEqualTo(first);
    }
}
