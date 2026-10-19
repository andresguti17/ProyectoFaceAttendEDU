package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.User;

/**
 * Resolves a login identifier to a single user.
 *
 * <p>A value containing '@' is matched case-insensitively against identity.person.email;
 * any other value is matched against app_user.username.
 */
public interface LoadUserByIdentifierPort {

    /**
     * @return the matching user, or {@code null} when the identifier is blank, unknown or
     *         matches more than one active user (ambiguous email, which must not leak
     *         whether the address exists).
     */
    User loadUserByIdentifier(String identifier);
}
