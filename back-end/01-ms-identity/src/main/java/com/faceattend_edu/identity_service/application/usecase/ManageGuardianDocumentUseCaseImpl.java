package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ManageGuardianDocumentUseCase;
import com.faceattend_edu.identity_service.application.port.out.GuardianDocumentStoragePort;
import com.faceattend_edu.identity_service.application.port.out.GuardianPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import com.faceattend_edu.identity_service.domain.model.GuardianDocumentType;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Collection;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ManageGuardianDocumentUseCaseImpl implements ManageGuardianDocumentUseCase {

    private static final Logger log = LoggerFactory.getLogger(ManageGuardianDocumentUseCaseImpl.class);

    private final GuardianPort guardianPort;
    private final GuardianDocumentStoragePort storage;

    @Override
    public Guardian upload(UUID minorPersonId, String originalFileName, byte[] content, UUID caller,
                           Collection<String> roles) {
        requireAdmin(roles);
        if (caller == null) throw new UnauthorizedException("Authentication required");
        if (content == null || content.length == 0) throw new ValidationException("file is required");
        if (content.length > MAX_SIZE_BYTES) throw new ValidationException("file must be at most 5 MB");
        GuardianDocumentType type = GuardianDocumentType.detect(content)
                .orElseThrow(() -> new ValidationException("file must be a PDF, JPG or PNG document"));
        Guardian guardian = guardianPort.findActiveByMinor(minorPersonId)
                .orElseThrow(() -> new EntityNotFoundException("Guardian", minorPersonId));

        // The key is generated here: nothing the client sends ends up in the object path.
        ZonedDateTime now = ZonedDateTime.now(ZoneOffset.UTC);
        String objectKey = String.format("%d/%02d/%s/%s.%s", now.getYear(), now.getMonthValue(),
                guardian.getGuardianId(), UUID.randomUUID(), type.extension());
        String storageUri = storage.put(objectKey, content, type.mimeType());
        String previousUri = guardian.getConsentDocumentUri();

        guardian.setConsentDocumentUri(storageUri);
        guardian.setConsentDocumentName(safeFileName(originalFileName, type));
        guardian.setConsentDocumentMime(type.mimeType());
        guardian.setConsentDocumentSize((long) content.length);
        guardian.setConsentDocumentUploadedAt(LocalDateTime.now());
        guardian.setUpdatedBy(caller);
        Guardian saved;
        try {
            saved = guardianPort.save(guardian);
        } catch (RuntimeException e) {
            // No row points at the object: remove it so storage does not keep orphans.
            removeQuietly(storageUri);
            throw e;
        }
        if (previousUri != null) removeQuietly(previousUri);
        return saved;
    }

    @Override
    public Document download(UUID minorPersonId, Collection<String> roles) {
        requireAdmin(roles);
        Guardian guardian = guardianPort.findActiveByMinor(minorPersonId)
                .filter(Guardian::hasConsentDocument)
                .orElseThrow(() -> new EntityNotFoundException("GuardianDocument", minorPersonId));
        byte[] content = storage.get(guardian.getConsentDocumentUri())
                .orElseThrow(() -> new EntityNotFoundException("GuardianDocument", minorPersonId));
        return new Document(guardian.getConsentDocumentName(), guardian.getConsentDocumentMime(), content);
    }

    private void removeQuietly(String storageUri) {
        try {
            storage.delete(storageUri);
        } catch (RuntimeException cleanup) {
            log.warn("Could not remove guardian document {}: {}", storageUri, cleanup.getMessage());
        }
    }

    private static void requireAdmin(Collection<String> roles) {
        if (!CallerRoles.isAdmin(roles)) throw new ForbiddenException("Only a school administrator can manage guardians");
    }

    /** Display name only: no path, no control characters or quotes, at most 255 characters. */
    static String safeFileName(String original, GuardianDocumentType type) {
        String name = original == null ? "" : original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (name.isEmpty()) name = "autorizacion." + type.extension();
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }
}
