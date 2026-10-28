package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.TermsAcceptanceJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.TermsAcceptanceJpaRepository;
import com.faceattend_edu.identity_service.application.port.out.TermsAcceptancePort;
import com.faceattend_edu.identity_service.domain.model.TermsAcceptance;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TermsAcceptancePersistenceAdapter implements TermsAcceptancePort {

    private final TermsAcceptanceJpaRepository repository;

    @Override
    public TermsAcceptance save(TermsAcceptance acceptance) {
        LocalDateTime now = LocalDateTime.now();
        TermsAcceptanceJpaEntity entity = new TermsAcceptanceJpaEntity();
        entity.setAcceptanceId(acceptance.getAcceptanceId() != null ? acceptance.getAcceptanceId() : UUID.randomUUID());
        entity.setPersonId(acceptance.getPersonId());
        entity.setTermsVersion(acceptance.getTermsVersion());
        entity.setUserType(acceptance.getUserType());
        entity.setAcceptedBy(acceptance.getAcceptedBy());
        entity.setGuardianId(acceptance.getGuardianId());
        entity.setChannel(acceptance.getChannel());
        entity.setRecordedBy(acceptance.getRecordedBy());
        entity.setSchoolId(acceptance.getSchoolId());
        entity.setAcceptedAt(acceptance.getAcceptedAt());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return toDomain(repository.save(entity));
    }

    @Override
    public Optional<TermsAcceptance> findCurrent(UUID personId) {
        return repository.findFirstByPersonIdOrderByAcceptedAtDesc(personId).map(TermsAcceptancePersistenceAdapter::toDomain);
    }

    private static TermsAcceptance toDomain(TermsAcceptanceJpaEntity e) {
        return new TermsAcceptance(e.getAcceptanceId(), e.getPersonId(), e.getTermsVersion(), e.getUserType(),
                e.getAcceptedBy(), e.getGuardianId(), e.getChannel(), e.getRecordedBy(), e.getSchoolId(), e.getAcceptedAt());
    }
}
