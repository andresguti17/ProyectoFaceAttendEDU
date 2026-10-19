package com.faceattend_edu.identity_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.HashSet;
import java.util.Arrays;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class User {
    private UUID userId;
    private Person personId;
    private String username;
    private String passwordHash;
    private String authenticationType;
    private Boolean status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastAccess;

    private static final Set<String> ALLOWED_AUTH_TYPES = new HashSet<>(Arrays.asList("Local", "Windows", "External"));

    public static final String DEFAULT_AUTHENTICATION_TYPE = "Local";

    public void validate() {
        Objects.requireNonNull(this, "User must not be null");
        if (this.personId == null || this.personId.getPersonId() == null) {
            throw new IllegalArgumentException("User.personId is required");
        }
        if (isNullOrBlank(this.username)) throw new IllegalArgumentException("User.username is required");
        if (isNullOrBlank(this.passwordHash)) throw new IllegalArgumentException("User.passwordHash is required");
        if (this.authenticationType != null && !ALLOWED_AUTH_TYPES.contains(this.authenticationType)) {
            throw new IllegalArgumentException("User.authenticationType is not supported");
        }
    }

    public boolean isActive() {
        return Boolean.TRUE.equals(this.status);
    }

    public void touchLastAccess() {
        this.lastAccess = LocalDateTime.now();
    }

    public String getMaskedPasswordHash() {
        if (this.passwordHash == null) return null;
        String h = this.passwordHash;
        if (h.length() <= 8) return "********";
        return h.substring(0, 4) + "..." + h.substring(h.length() - 4);
    }

    private static boolean isNullOrBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
