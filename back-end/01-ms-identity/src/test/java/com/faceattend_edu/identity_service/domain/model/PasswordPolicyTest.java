package com.faceattend_edu.identity_service.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Reglas de la política de contraseña: longitudes coherentes y expiración positiva. */
@DisplayName("PasswordPolicy domain model tests")
class PasswordPolicyTest {

    @Test
    @DisplayName("validate_passesForAConsistentPolicy")
    void validate_passesForAConsistentPolicy() {
        PasswordPolicy policy = policy(8, 20, 90);

        assertDoesNotThrow(policy::validate);
    }

    @ParameterizedTest(name = "[{index}] {3}")
    @MethodSource("invalidPolicies")
    @DisplayName("validate_throwsIllegalArgumentExceptionForInvalidBounds")
    void validate_throwsIllegalArgumentExceptionForInvalidBounds(
            Integer minLength, Integer maxLength, Integer expirationDays, String description) {
        PasswordPolicy policy = policy(minLength, maxLength, expirationDays);

        assertThrows(IllegalArgumentException.class, policy::validate);
    }

    static Stream<Arguments> invalidPolicies() {
        return Stream.of(
                Arguments.of(null, 20, 90, "minLength null"),
                Arguments.of(0, 20, 90, "minLength below 1"),
                Arguments.of(8, null, 90, "maxLength null"),
                Arguments.of(8, 7, 90, "maxLength below minLength"),
                Arguments.of(8, 20, null, "expirationDays null"),
                Arguments.of(8, 20, 0, "expirationDays below 1"));
    }

    private static PasswordPolicy policy(Integer minLength, Integer maxLength, Integer expirationDays) {
        PasswordPolicy policy = new PasswordPolicy();
        policy.setMinLength(minLength);
        policy.setMaxLength(maxLength);
        policy.setRequiresUppercase(true);
        policy.setRequiresNumbers(true);
        policy.setRequiresSymbols(true);
        policy.setExpirationDays(expirationDays);
        return policy;
    }
}
