package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.UpdateOwnProfileUseCase;
import com.faceattend_edu.identity_service.application.port.out.HashPasswordPort;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdatePersonPort;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.BloodType;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.UUID;

/**
 * Starts from the stored person and touches only the editable fields, so a
 * client can never reach names, document or status through this path. The
 * email is also the login identifier and the recovery channel, so changing it
 * requires the current password.
 */
@RequiredArgsConstructor
@Service
public class UpdateOwnProfileUseCaseImpl implements UpdateOwnProfileUseCase {

    private final LoadUserPort loadUserPort;
    private final LoadPersonPort loadPersonPort;
    private final UpdatePersonPort updatePersonPort;
    private final HashPasswordPort hashPasswordPort;

    @Override
    @Transactional
    public Person updateProfile(UUID userId, ProfileChanges changes) {
        User user = loadUserPort.loadUser(userId);
        if (user == null || user.getPersonId() == null || user.getPersonId().getPersonId() == null) {
            throw new EntityNotFoundException("User", userId);
        }
        UUID personId = user.getPersonId().getPersonId();
        Person person = loadPersonPort.loadPerson(personId);
        if (person == null) {
            throw new EntityNotFoundException("Person", personId);
        }

        if (changes.birthDate() != null && changes.birthDate().isAfter(LocalDate.now())) {
            throw new ValidationException("birthDate cannot be in the future");
        }

        String newEmail = blankToNull(changes.email());
        if (newEmail != null && !newEmail.equalsIgnoreCase(person.getEmail())) {
            String current = changes.currentPassword();
            if (current == null || current.isBlank() || !hashPasswordPort.matches(current, user.getPasswordHash())) {
                throw new ValidationException("Current password is incorrect");
            }
            person.setEmail(newEmail.toLowerCase(Locale.ROOT));
        }

        person.setPhone(blankToNull(changes.phone()));
        person.setAddress(blankToNull(changes.address()));
        person.setBirthDate(changes.birthDate());
        person.setBloodType(BloodType.fromCode(changes.bloodType()));

        person.setUpdatedAt(LocalDateTime.now());
        person.setUpdatedBy(userId);
        person.validate();
        updatePersonPort.updatePerson(person);
        return person;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
