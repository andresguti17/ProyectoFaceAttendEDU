package com.faceattend_edu.identity_service.application.usecase;

import java.util.Collection;
import java.util.Locale;
import java.util.Set;

/** Role checks shared by the guardian and terms use cases. */
final class CallerRoles {

    private static final Set<String> ADMIN_ROLES = Set.of("administrador", "super administrador", "admin", "super_admin");

    private CallerRoles() {}

    static boolean isAdmin(Collection<String> roles) {
        return roles != null && roles.stream()
                .anyMatch(r -> r != null && ADMIN_ROLES.contains(r.trim().toLowerCase(Locale.ROOT)));
    }
}
