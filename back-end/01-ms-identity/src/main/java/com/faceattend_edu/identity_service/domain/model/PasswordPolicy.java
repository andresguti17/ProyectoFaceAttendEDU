package com.faceattend_edu.identity_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.Objects;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PasswordPolicy {
    private Integer policyId;
    private Integer minLength;
    private Integer maxLength;
    private Boolean requiresUppercase;
    private Boolean requiresNumbers;
    private Boolean requiresSymbols;
    private Integer expirationDays;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public void validate() {
        Objects.requireNonNull(this, "PasswordPolicy must not be null");
        if (this.minLength == null || this.minLength < 1) throw new IllegalArgumentException("PasswordPolicy.minLength is required");
        if (this.maxLength == null || this.maxLength < this.minLength) throw new IllegalArgumentException("PasswordPolicy.maxLength must be >= minLength");
        if (this.expirationDays == null || this.expirationDays < 1) throw new IllegalArgumentException("PasswordPolicy.expirationDays is required");
    }
}
