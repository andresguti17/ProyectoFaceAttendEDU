package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.DataProcessingConsentJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.DataProcessingConsentJpaRepository;
import com.faceattend_edu.identity_service.application.port.out.ConsentPort;
import com.faceattend_edu.identity_service.domain.model.DataProcessingConsent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class ConsentPersistenceAdapter implements ConsentPort {

    private final DataProcessingConsentJpaRepository repository;

    @Override
    public DataProcessingConsent save(DataProcessingConsent consent) {
        DataProcessingConsentJpaEntity entity = consent.getConsentId() == null ? null
                : repository.findById(consent.getConsentId()).orElse(null);
        LocalDateTime now = LocalDateTime.now();
        if (entity == null) {
            entity = new DataProcessingConsentJpaEntity();
            entity.setConsentId(consent.getConsentId() != null ? consent.getConsentId() : UUID.randomUUID());
            entity.setCreatedAt(now);
        }
        entity.setPersonId(consent.getPersonId());
        entity.setPolicyVersion(consent.getPolicyVersion());
        entity.setAcceptedAt(consent.getAcceptedAt());
        entity.setBiometricAccepted(consent.isBiometricAccepted());
        entity.setBiometricRevokedAt(consent.getBiometricRevokedAt());
        entity.setChannel(consent.getChannel());
        entity.setRecordedBy(consent.getRecordedBy());
        entity.setUpdatedAt(now);
        return toDomain(repository.save(entity));
    }

    @Override
    public Optional<DataProcessingConsent> findCurrent(UUID personId) {
        return repository.findFirstByPersonIdOrderByAcceptedAtDesc(personId).map(ConsentPersistenceAdapter::toDomain);
    }

    private static DataProcessingConsent toDomain(DataProcessingConsentJpaEntity e) {
        return new DataProcessingConsent(e.getConsentId(), e.getPersonId(), e.getPolicyVersion(), e.getAcceptedAt(),
                Boolean.TRUE.equals(e.getBiometricAccepted()), e.getBiometricRevokedAt(), e.getChannel(), e.getRecordedBy());
    }
}
