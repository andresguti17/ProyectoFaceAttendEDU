package com.faceattend_edu.identity_service.adapter.out.persistence.entity;

import com.faceattend_edu.identity_service.adapter.out.persistence.crypto.PiiCipher;
import com.faceattend_edu.identity_service.adapter.out.persistence.crypto.PiiStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.util.Locale;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "person", schema = "identity",
        uniqueConstraints = @UniqueConstraint(name = "uq_person_document_hash", columnNames = {"document_hash"}))
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PersonJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "person_id")
    private UUID personId;

    // Personal data encrypted at rest (Ley 1581 art. 4-g); see PiiCipher.
    @Convert(converter = PiiStringConverter.class)
    @Column(name = "document_number", nullable = false, length = 255)
    private String documentNumber;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Convert(converter = PiiStringConverter.class)
    @Column(name = "email", length = 512)
    private String email;

    @Convert(converter = PiiStringConverter.class)
    @Column(name = "phone", length = 255)
    private String phone;

    @Column(name = "document_type", length = 10)
    private String documentType;

    /** Health data, sensitive under art. 5. */
    @Convert(converter = PiiStringConverter.class)
    @Column(name = "blood_type", length = 255)
    private String bloodType;

    /** Blind index for the login by e-mail and its uniqueness. */
    @Column(name = "email_hash", length = 64)
    private String emailHash;

    /** Blind index for the (document type, document number) uniqueness. */
    @Column(name = "document_hash", length = 64)
    private String documentHash;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "address")
    private String address;

    @Column(name = "status", nullable = false)
    private Boolean status;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_by")
    private UUID deletedBy;

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;

    @PrePersist
    @PreUpdate
    public void refreshHashes() {
        PiiCipher cipher = PiiCipher.current();
        this.emailHash = cipher.hash(normalizeEmail(email));
        this.documentHash = cipher.hash(normalizeDocument(documentType, documentNumber));
    }

    public static String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    public static String normalizeDocument(String type, String number) {
        if (number == null || number.isBlank()) return null;
        return (type == null ? "" : type.trim().toUpperCase(Locale.ROOT)) + "|" + number.trim();
    }
}
