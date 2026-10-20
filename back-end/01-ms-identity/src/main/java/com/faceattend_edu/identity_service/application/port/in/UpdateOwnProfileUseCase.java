package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Person;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Self-service profile edit. Only these fields can change; names, document,
 * status, username, role and school stay with the administration.
 */
public interface UpdateOwnProfileUseCase {

    /**
     * @param phone           replaced as sent; blank clears it
     * @param address         replaced as sent; blank clears it
     * @param birthDate       replaced as sent; null clears it, a future date is rejected
     * @param bloodType       replaced as sent; blank clears it
     * @param email           ignored when blank or unchanged; a new address needs {@code currentPassword}
     * @param currentPassword the caller's password, only checked when the email changes
     */
    record ProfileChanges(String phone, String address, LocalDate birthDate, String bloodType,
                          String email, String currentPassword) {}

    Person updateProfile(UUID userId, ProfileChanges changes);
}
