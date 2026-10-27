package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.GuardianJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.entity.TermsAcceptanceJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.GuardianJpaRepository;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.TermsAcceptanceJpaRepository;
import com.faceattend_edu.identity_service.adapter.out.provisioning.PersonSchoolHttpAdapter;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import com.faceattend_edu.identity_service.domain.model.TermsAcceptance;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("Guardian and terms persistence")
class GuardianAndTermsPersistenceTest {

    @Mock GuardianJpaRepository guardianRepository;
    @Mock TermsAcceptanceJpaRepository termsRepository;
    @InjectMocks GuardianPersistenceAdapter guardianAdapter;
    @InjectMocks TermsAcceptancePersistenceAdapter termsAdapter;

    @Test
    void aNewGuardianIsInsertedWithItsAuditTrail() {
        UUID admin = UUID.randomUUID();
        Guardian guardian = new Guardian();
        guardian.setGuardianId(UUID.randomUUID());
        guardian.setMinorPersonId(UUID.randomUUID());
        guardian.setFullName("Ana Gómez");
        guardian.setDocumentType("CC");
        guardian.setDocumentNumber("5005");
        guardian.setRelationship("Madre");
        guardian.setSchoolId(4L);
        guardian.setCreatedBy(admin);
        guardian.setUpdatedBy(admin);
        when(guardianRepository.findById(guardian.getGuardianId())).thenReturn(Optional.empty());
        when(guardianRepository.save(any())).thenAnswer(call -> call.getArgument(0));

        Guardian saved = guardianAdapter.save(guardian);

        assertThat(saved.getFullName()).isEqualTo("Ana Gómez");
        assertThat(saved.getSchoolId()).isEqualTo(4L);
        assertThat(saved.getCreatedBy()).isEqualTo(admin);
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void editingAGuardianKeepsTheOriginalCreator() {
        UUID creator = UUID.randomUUID();
        UUID editor = UUID.randomUUID();
        GuardianJpaEntity stored = new GuardianJpaEntity();
        stored.setGuardianId(UUID.randomUUID());
        stored.setCreatedBy(creator);
        stored.setCreatedAt(LocalDateTime.now().minusDays(2));
        when(guardianRepository.findById(stored.getGuardianId())).thenReturn(Optional.of(stored));
        when(guardianRepository.save(any())).thenAnswer(call -> call.getArgument(0));
        Guardian edit = new Guardian();
        edit.setGuardianId(stored.getGuardianId());
        edit.setFullName("Ana María");
        edit.setUpdatedBy(editor);

        Guardian saved = guardianAdapter.save(edit);

        assertThat(saved.getCreatedBy()).isEqualTo(creator);
        assertThat(saved.getUpdatedBy()).isEqualTo(editor);
        assertThat(saved.getFullName()).isEqualTo("Ana María");
    }

    @Test
    void removingAGuardianSoftDeletesAndFlushes() {
        UUID admin = UUID.randomUUID();
        GuardianJpaEntity stored = new GuardianJpaEntity();
        stored.setGuardianId(UUID.randomUUID());
        when(guardianRepository.findById(stored.getGuardianId())).thenReturn(Optional.of(stored));

        guardianAdapter.remove(stored.getGuardianId(), admin);

        ArgumentCaptor<GuardianJpaEntity> captor = ArgumentCaptor.forClass(GuardianJpaEntity.class);
        verify(guardianRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getDeletedAt()).isNotNull();
        assertThat(captor.getValue().getDeletedBy()).isEqualTo(admin);
    }

    @Test
    void theActiveGuardianIsReadByMinor() {
        UUID minor = UUID.randomUUID();
        GuardianJpaEntity stored = new GuardianJpaEntity();
        stored.setGuardianId(UUID.randomUUID());
        stored.setMinorPersonId(minor);
        stored.setFullName("Ana Gómez");
        when(guardianRepository.findFirstByMinorPersonIdAndDeletedAtIsNull(minor)).thenReturn(Optional.of(stored));

        assertThat(guardianAdapter.findActiveByMinor(minor)).map(Guardian::getFullName).contains("Ana Gómez");
    }

    @Test
    void anAcceptanceKeepsVersionTypeWhoAndSchool() {
        TermsAcceptance acceptance = new TermsAcceptance();
        acceptance.setPersonId(UUID.randomUUID());
        acceptance.setTermsVersion("2026-10");
        acceptance.setUserType(TermsAcceptance.MINOR);
        acceptance.setAcceptedBy(TermsAcceptance.BY_GUARDIAN);
        acceptance.setGuardianId(UUID.randomUUID());
        acceptance.setChannel("assisted");
        acceptance.setRecordedBy(UUID.randomUUID());
        acceptance.setSchoolId(9L);
        acceptance.setAcceptedAt(LocalDateTime.now());
        when(termsRepository.save(any())).thenAnswer(call -> call.getArgument(0));

        TermsAcceptance saved = termsAdapter.save(acceptance);

        assertThat(saved.getAcceptanceId()).isNotNull();
        assertThat(saved.getUserType()).isEqualTo("MINOR");
        assertThat(saved.getSchoolId()).isEqualTo(9L);
        assertThat(saved.getRecordedBy()).isEqualTo(acceptance.getRecordedBy());
    }

    @Test
    void theCurrentAcceptanceIsTheLatestOne() {
        UUID person = UUID.randomUUID();
        TermsAcceptanceJpaEntity stored = new TermsAcceptanceJpaEntity();
        stored.setAcceptanceId(UUID.randomUUID());
        stored.setPersonId(person);
        stored.setTermsVersion("2026-10");
        when(termsRepository.findFirstByPersonIdOrderByAcceptedAtDesc(person)).thenReturn(Optional.of(stored));

        assertThat(termsAdapter.findCurrent(person)).map(TermsAcceptance::getTermsVersion).contains("2026-10");
    }

    @Test
    void theSchoolLookupNeverBlocksTheAcceptance() {
        PersonSchoolHttpAdapter adapter = new PersonSchoolHttpAdapter();
        ReflectionTestUtils.setField(adapter, "academicUrl", "http://127.0.0.1:1");

        assertThat(adapter.schoolOf(null, UUID.randomUUID())).isEmpty();
        assertThat(adapter.schoolOf("token", UUID.randomUUID())).isEmpty();
        verify(guardianRepository, never()).save(any());
    }
}
