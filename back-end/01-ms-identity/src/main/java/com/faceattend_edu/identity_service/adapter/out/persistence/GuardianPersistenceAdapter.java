package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.GuardianJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.GuardianJpaRepository;
import com.faceattend_edu.identity_service.application.port.out.GuardianPort;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class GuardianPersistenceAdapter implements GuardianPort {

    private final GuardianJpaRepository repository;

    @Override
    public Guardian save(Guardian guardian) {
        GuardianJpaEntity entity = guardian.getGuardianId() == null ? null
                : repository.findById(guardian.getGuardianId()).orElse(null);
        LocalDateTime now = LocalDateTime.now();
        if (entity == null) {
            entity = new GuardianJpaEntity();
            entity.setGuardianId(guardian.getGuardianId() != null ? guardian.getGuardianId() : UUID.randomUUID());
            entity.setCreatedAt(guardian.getCreatedAt() != null ? guardian.getCreatedAt() : now);
            entity.setCreatedBy(guardian.getCreatedBy());
        }
        entity.setMinorPersonId(guardian.getMinorPersonId());
        entity.setFullName(guardian.getFullName());
        entity.setDocumentType(guardian.getDocumentType());
        entity.setDocumentNumber(guardian.getDocumentNumber());
        entity.setEmail(guardian.getEmail());
        entity.setPhone(guardian.getPhone());
        entity.setRelationship(guardian.getRelationship());
        entity.setSchoolId(guardian.getSchoolId());
        entity.setConsentDocumentUri(guardian.getConsentDocumentUri());
        entity.setConsentDocumentName(guardian.getConsentDocumentName());
        entity.setConsentDocumentMime(guardian.getConsentDocumentMime());
        entity.setConsentDocumentSize(guardian.getConsentDocumentSize());
        entity.setConsentDocumentUploadedAt(guardian.getConsentDocumentUploadedAt());
        entity.setUpdatedBy(guardian.getUpdatedBy());
        entity.setUpdatedAt(now);
        return toDomain(repository.save(entity));
    }

    @Override
    public Optional<Guardian> findActiveByMinor(UUID minorPersonId) {
        return repository.findFirstByMinorPersonIdAndDeletedAtIsNull(minorPersonId).map(GuardianPersistenceAdapter::toDomain);
    }

    @Override
    public void remove(UUID guardianId, UUID deletedBy) {
        repository.findById(guardianId).ifPresent(entity -> {
            entity.setDeletedAt(LocalDateTime.now());
            entity.setDeletedBy(deletedBy);
            // flush so the unique "one active guardian per minor" index is free for the replacement
            repository.saveAndFlush(entity);
        });
    }

    private static Guardian toDomain(GuardianJpaEntity e) {
        return new Guardian(e.getGuardianId(), e.getMinorPersonId(), e.getFullName(), e.getDocumentType(),
                e.getDocumentNumber(), e.getEmail(), e.getPhone(), e.getRelationship(), e.getSchoolId(),
                e.getCreatedAt(), e.getUpdatedAt(), e.getCreatedBy(), e.getUpdatedBy(),
                e.getConsentDocumentUri(), e.getConsentDocumentName(), e.getConsentDocumentMime(),
                e.getConsentDocumentSize(), e.getConsentDocumentUploadedAt());
    }
}
