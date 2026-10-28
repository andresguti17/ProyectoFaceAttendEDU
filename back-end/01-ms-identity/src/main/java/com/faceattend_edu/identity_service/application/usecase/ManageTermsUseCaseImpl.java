package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ManageTermsUseCase;
import com.faceattend_edu.identity_service.application.port.out.GuardianPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.PersonSchoolPort;
import com.faceattend_edu.identity_service.application.port.out.TermsAcceptancePort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.DataProcessingConsent;
import com.faceattend_edu.identity_service.domain.model.Enablement;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.TermsAcceptance;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ManageTermsUseCaseImpl implements ManageTermsUseCase {

    private final TermsAcceptancePort termsPort;
    private final GuardianPort guardianPort;
    private final LoadPersonPort loadPersonPort;
    private final LoadUserPort loadUserPort;
    private final PersonSchoolPort personSchoolPort;

    /** A minor needs the guardian's signed authorization on file (Ley 1581 art. 7); off only to stage a rollout. */
    @Value("${faceattend.guardian.document-required:true}")
    private boolean documentRequired = true;

    @Value("${faceattend.terms.version:2026-10}")
    private String termsVersion = "2026-10";

    @Override
    public String currentTermsVersion() {
        return termsVersion;
    }

    @Override
    public Enablement enablement(UUID personId, UUID caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required");
        return compute(requirePerson(personId));
    }

    @Override
    public Enablement accept(UUID personId, String version, UUID caller, Collection<String> roles, String bearer) {
        if (caller == null) throw new UnauthorizedException("Authentication required");
        if (version == null || !version.equals(termsVersion)) {
            throw new ValidationException("termsVersion must be the terms in force (" + termsVersion + ")");
        }
        Person person = requirePerson(personId);
        boolean minor = person.isMinor(LocalDate.now());
        boolean holder = isHolder(caller, personId);

        TermsAcceptance acceptance = new TermsAcceptance();
        acceptance.setPersonId(personId);
        acceptance.setTermsVersion(version);
        acceptance.setAcceptedAt(LocalDateTime.now());
        acceptance.setRecordedBy(caller);
        if (!minor) {
            // An adult signs their own terms: nobody can accept them on their behalf.
            if (!holder) throw new ForbiddenException("An adult must accept their own terms");
            acceptance.setUserType(TermsAcceptance.ADULT);
            acceptance.setAcceptedBy(TermsAcceptance.BY_SELF);
            acceptance.setChannel(DataProcessingConsent.SELF);
        } else {
            if (holder || !CallerRoles.isAdmin(roles)) {
                throw new ForbiddenException("The terms of a minor are accepted by the guardian in person before a school administrator");
            }
            Guardian guardian = guardianPort.findActiveByMinor(personId)
                    .orElseThrow(() -> new ValidationException("Register the guardian of the minor before recording the terms"));
            acceptance.setUserType(TermsAcceptance.MINOR);
            acceptance.setAcceptedBy(TermsAcceptance.BY_GUARDIAN);
            acceptance.setGuardianId(guardian.getGuardianId());
            acceptance.setChannel(DataProcessingConsent.ASSISTED);
        }

        // Accepted once: repeating it for the same version (and guardian) adds no row.
        if (compute(person).termsUpToDate()) return compute(person);
        acceptance.setSchoolId(personSchoolPort.schoolOf(bearer, personId).orElse(null));
        termsPort.save(acceptance);
        return compute(person);
    }

    private Enablement compute(Person person) {
        UUID personId = person.getPersonId();
        boolean minor = person.isMinor(LocalDate.now());
        Optional<Guardian> guardian = minor ? guardianPort.findActiveByMinor(personId) : Optional.empty();
        Optional<TermsAcceptance> current = termsPort.findCurrent(personId);

        boolean upToDate = current.filter(a -> termsVersion.equals(a.getTermsVersion()))
                // The terms of a minor count only for the guardian who is linked now.
                .filter(a -> !minor || (guardian.isPresent() && guardian.get().getGuardianId().equals(a.getGuardianId())))
                .isPresent();

        Enablement.Status status;
        if (minor && guardian.isEmpty()) status = Enablement.Status.GUARDIAN_PENDING;
        else if (minor && documentRequired && !guardian.get().hasConsentDocument()) status = Enablement.Status.DOCUMENT_PENDING;
        else if (!upToDate) status = Enablement.Status.TERMS_PENDING;
        else status = Enablement.Status.ENABLED;

        return new Enablement(personId, minor, guardian.isPresent(), current.isPresent(), upToDate,
                current.map(TermsAcceptance::getTermsVersion).orElse(null),
                current.map(TermsAcceptance::getAcceptedAt).orElse(null), termsVersion, status);
    }

    private Person requirePerson(UUID personId) {
        Person person = loadPersonPort.loadPerson(personId);
        if (person == null) throw new EntityNotFoundException("Person", personId);
        return person;
    }

    private boolean isHolder(UUID caller, UUID personId) {
        User user = loadUserPort.loadUser(caller);
        return user != null && user.getPersonId() != null && personId.equals(user.getPersonId().getPersonId());
    }
}
