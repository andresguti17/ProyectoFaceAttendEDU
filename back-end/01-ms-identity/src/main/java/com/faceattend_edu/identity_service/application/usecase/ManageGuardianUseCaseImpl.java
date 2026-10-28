package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ManageGuardianUseCase;
import com.faceattend_edu.identity_service.application.port.out.GuardianPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.PersonSchoolPort;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ForbiddenException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Guardian;
import com.faceattend_edu.identity_service.domain.model.Person;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ManageGuardianUseCaseImpl implements ManageGuardianUseCase {

    /** A guardian is an adult: no TI. */
    private static final Set<String> GUARDIAN_DOCUMENT_TYPES = Set.of("CC", "CE", "PP");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MAX_TEXT = 255;

    private final GuardianPort guardianPort;
    private final LoadPersonPort loadPersonPort;
    private final PersonSchoolPort personSchoolPort;

    @Override
    public Optional<Guardian> find(UUID minorPersonId, Collection<String> roles) {
        requireAdmin(roles);
        return guardianPort.findActiveByMinor(minorPersonId);
    }

    @Override
    public Guardian register(UUID minorPersonId, GuardianData data, UUID caller, Collection<String> roles, String bearer) {
        requireAdmin(roles);
        requireCaller(caller);
        Person minor = requireMinor(minorPersonId);
        validate(data, minor);
        if (guardianPort.findActiveByMinor(minorPersonId).isPresent()) {
            throw new DuplicateEntityException("Guardian", minorPersonId);
        }
        return guardianPort.save(build(minorPersonId, data, caller, bearer));
    }

    @Override
    public Guardian update(UUID minorPersonId, GuardianData data, UUID caller, Collection<String> roles, String bearer) {
        requireAdmin(roles);
        requireCaller(caller);
        Person minor = requireMinor(minorPersonId);
        validate(data, minor);
        Guardian current = guardianPort.findActiveByMinor(minorPersonId)
                .orElseThrow(() -> new EntityNotFoundException("Guardian", minorPersonId));
        boolean sameGuardian = current.getDocumentType().equals(data.documentType().trim().toUpperCase(Locale.ROOT))
                && current.getDocumentNumber().equals(data.documentNumber().trim());
        if (!sameGuardian) {
            // Another person: the terms accepted by the previous guardian no longer cover the minor.
            guardianPort.remove(current.getGuardianId(), caller);
            return guardianPort.save(build(minorPersonId, data, caller, bearer));
        }
        apply(current, data);
        current.setUpdatedBy(caller);
        current.setUpdatedAt(LocalDateTime.now());
        return guardianPort.save(current);
    }

    private Guardian build(UUID minorPersonId, GuardianData data, UUID caller, String bearer) {
        Guardian guardian = new Guardian();
        guardian.setGuardianId(UUID.randomUUID());
        guardian.setMinorPersonId(minorPersonId);
        apply(guardian, data);
        guardian.setSchoolId(personSchoolPort.schoolOf(bearer, minorPersonId).orElse(null));
        guardian.setCreatedBy(caller);
        guardian.setUpdatedBy(caller);
        guardian.setCreatedAt(LocalDateTime.now());
        guardian.setUpdatedAt(guardian.getCreatedAt());
        return guardian;
    }

    private static void apply(Guardian guardian, GuardianData data) {
        guardian.setFullName(data.fullName().trim());
        guardian.setDocumentType(data.documentType().trim().toUpperCase(Locale.ROOT));
        guardian.setDocumentNumber(data.documentNumber().trim());
        guardian.setEmail(blankToNull(data.email()));
        guardian.setPhone(blankToNull(data.phone()));
        guardian.setRelationship(data.relationship().trim());
    }

    private Person requireMinor(UUID minorPersonId) {
        Person person = loadPersonPort.loadPerson(minorPersonId);
        if (person == null) throw new EntityNotFoundException("Person", minorPersonId);
        if (!person.isMinor(LocalDate.now())) {
            throw new ValidationException("A guardian can only be registered for a minor");
        }
        return person;
    }

    private static void validate(GuardianData data, Person minor) {
        if (data == null) throw new ValidationException("Guardian data is required");
        if (isBlank(data.fullName())) throw new ValidationException("Guardian full name is required");
        if (isBlank(data.documentNumber())) throw new ValidationException("Guardian document number is required");
        if (isBlank(data.relationship())) throw new ValidationException("Guardian relationship is required");
        if (isBlank(data.documentType())
                || !GUARDIAN_DOCUMENT_TYPES.contains(data.documentType().trim().toUpperCase(Locale.ROOT))) {
            throw new ValidationException("Guardian document type must be one of CC, CE, PP");
        }
        if (isBlank(data.email()) && isBlank(data.phone())) {
            throw new ValidationException("Guardian needs an e-mail or a phone to be contacted");
        }
        if (!isBlank(data.email()) && !EMAIL.matcher(data.email().trim()).matches()) {
            throw new ValidationException("Guardian e-mail is not valid");
        }
        if (data.fullName().length() > MAX_TEXT || data.relationship().length() > 30
                || data.documentNumber().length() > 50 || (data.phone() != null && data.phone().length() > 50)
                || (data.email() != null && data.email().length() > MAX_TEXT)) {
            throw new ValidationException("Guardian data exceeds the allowed length");
        }
        if (minor.getDocumentNumber() != null && minor.getDocumentNumber().equals(data.documentNumber().trim())) {
            throw new ValidationException("The guardian cannot be the minor");
        }
    }

    private static void requireAdmin(Collection<String> roles) {
        if (!CallerRoles.isAdmin(roles)) throw new ForbiddenException("Only a school administrator can manage guardians");
    }

    private static void requireCaller(UUID caller) {
        if (caller == null) throw new UnauthorizedException("Authentication required");
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }
}
