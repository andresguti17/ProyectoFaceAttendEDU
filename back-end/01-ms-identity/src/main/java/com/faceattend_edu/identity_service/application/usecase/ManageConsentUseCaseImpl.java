package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ManageConsentUseCase;
import com.faceattend_edu.identity_service.application.port.out.ConsentPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.DataProcessingConsent;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ManageConsentUseCaseImpl implements ManageConsentUseCase {

    private static final Set<String> ADMIN_ROLES = Set.of("administrador", "super administrador", "admin", "super_admin");

    private final ConsentPort consentPort;
    private final LoadUserPort loadUserPort;

    @Value("${faceattend.privacy.policy-version:2026-10}")
    private String policyVersion = "2026-10";

    @Override
    public String currentPolicyVersion() {
        return policyVersion;
    }

    @Override
    public Optional<DataProcessingConsent> current(UUID personId, UUID caller, Collection<String> roles) {
        requireOwnerOrAdmin(personId, caller, roles);
        return consentPort.findCurrent(personId);
    }

    @Override
    public DataProcessingConsent accept(UUID personId, String version, boolean biometricAccepted,
                                        UUID caller, Collection<String> roles) {
        boolean own = requireOwnerOrAdmin(personId, caller, roles);
        return save(personId, version, biometricAccepted, own ? DataProcessingConsent.SELF : DataProcessingConsent.ASSISTED, caller);
    }

    @Override
    public DataProcessingConsent revokeBiometric(UUID personId, UUID caller, Collection<String> roles) {
        requireOwnerOrAdmin(personId, caller, roles);
        DataProcessingConsent consent = consentPort.findCurrent(personId)
                .orElseThrow(() -> new EntityNotFoundException("DataProcessingConsent", personId));
        if (consent.getBiometricRevokedAt() == null) {
            consent.setBiometricRevokedAt(LocalDateTime.now());
            consent = consentPort.save(consent);
        }
        return consent;
    }

    @Override
    public DataProcessingConsent recordSelf(UUID personId, String version, boolean biometricAccepted) {
        return save(personId, version, biometricAccepted, DataProcessingConsent.SELF, null);
    }

    @Override
    public DataProcessingConsent recordAssisted(UUID personId, String version, boolean biometricAccepted, UUID recordedBy) {
        return save(personId, version, biometricAccepted, DataProcessingConsent.ASSISTED, recordedBy);
    }

    private DataProcessingConsent save(UUID personId, String version, boolean biometricAccepted, String channel, UUID recordedBy) {
        // Only the notice in force can be accepted: an old version would not prove what the holder read.
        if (version == null || !version.equals(policyVersion)) {
            throw new ValidationException("policyVersion must be the privacy notice in force (" + policyVersion + ")");
        }
        DataProcessingConsent consent = new DataProcessingConsent();
        consent.setPersonId(personId);
        consent.setPolicyVersion(version);
        consent.setAcceptedAt(LocalDateTime.now());
        consent.setBiometricAccepted(biometricAccepted);
        consent.setChannel(channel);
        consent.setRecordedBy(recordedBy);
        return consentPort.save(consent);
    }

    /** @return true when the caller is the holder; administrators may act on others (assisted). */
    private boolean requireOwnerOrAdmin(UUID personId, UUID caller, Collection<String> roles) {
        if (caller == null) throw new UnauthorizedException("Authentication required");
        User user = loadUserPort.loadUser(caller);
        boolean own = user != null && user.getPersonId() != null && personId.equals(user.getPersonId().getPersonId());
        if (own) return true;
        boolean admin = roles != null && roles.stream()
                .anyMatch(r -> r != null && ADMIN_ROLES.contains(r.trim().toLowerCase(Locale.ROOT)));
        if (!admin) throw new ForbiddenException("Only the holder or an administrator can manage this authorization");
        return false;
    }
}
