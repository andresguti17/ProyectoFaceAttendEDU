package com.faceattend_edu.identity_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.regex.Pattern;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Person {
    private UUID personId;
    private String documentNumber;
    private String name;
    private String lastName;
    private String email;
    private String phone;
    private String documentType;
    private BloodType bloodType;
    private LocalDate birthDate;
    private String address;
    private Boolean status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    /** chk_person_document_type (AGENTS.md 2.5). */
    public static final java.util.Set<String> DOCUMENT_TYPES = java.util.Set.of("CC", "TI", "CE", "PP");
    private static final int MAX_TEXT = 255;

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public void validate() {
        if (isNullOrBlank(this.documentNumber)) throw new IllegalArgumentException("Person.documentNumber is required");
        if (isNullOrBlank(this.name)) throw new IllegalArgumentException("Person.name is required");
        if (isNullOrBlank(this.lastName)) throw new IllegalArgumentException("Person.lastName is required");
        if (this.email != null && !EMAIL_PATTERN.matcher(this.email).matches()) {
            throw new IllegalArgumentException("Person.email is not a valid email");
        }
        if (this.documentNumber != null && this.documentNumber.length() > 50) {
            throw new IllegalArgumentException("Person.documentNumber max 50");
        }
        if (this.documentType != null && !DOCUMENT_TYPES.contains(this.documentType)) {
            throw new IllegalArgumentException("Person.documentType must be one of CC, TI, CE, PP");
        }
        if (tooLong(this.name)) throw new IllegalArgumentException("Person.name max " + MAX_TEXT);
        if (tooLong(this.lastName)) throw new IllegalArgumentException("Person.lastName max " + MAX_TEXT);
        if (tooLong(this.email)) throw new IllegalArgumentException("Person.email max " + MAX_TEXT);
        if (tooLong(this.address)) throw new IllegalArgumentException("Person.address max " + MAX_TEXT);
        if (this.phone != null && this.phone.length() > 50) throw new IllegalArgumentException("Person.phone max 50");
    }

    /** Age of majority in Colombia (Ley 27 de 1990). */
    public static final int ADULT_AGE = 18;

    /**
     * Minor when the birth date says so; without a birth date, a TI (tarjeta de identidad,
     * issued to people under 18) is treated as a minor, the safe side for children's data.
     */
    public boolean isMinor(LocalDate today) {
        if (this.birthDate != null) return this.birthDate.plusYears(ADULT_AGE).isAfter(today);
        return "TI".equals(this.documentType);
    }

    public String getFullName() {
        String n = this.name == null ? "" : this.name.trim();
        String ln = this.lastName == null ? "" : this.lastName.trim();
        return (n + " " + ln).trim();
    }

    public boolean isActive() {
        return Boolean.TRUE.equals(this.status);
    }

    public void touchCreatedIfMissing() {
        if (this.createdAt == null) this.createdAt = LocalDateTime.now();
    }

    private static boolean tooLong(String s) {
        return s != null && s.length() > MAX_TEXT;
    }

    private static boolean isNullOrBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
