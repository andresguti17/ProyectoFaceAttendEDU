package com.faceattend_edu.identity_service.adapter.out.persistence.entity;

import com.faceattend_edu.identity_service.adapter.out.persistence.crypto.PiiStringConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** Guardian of a minor: identification and contact are encrypted at rest (Ley 1581 art. 4-g). */
@Entity
@Table(name = "guardian", schema = "identity")
@Getter
@Setter
@NoArgsConstructor
public class GuardianJpaEntity {

    @Id
    @Column(name = "guardian_id")
    private UUID guardianId;

    @Column(name = "minor_person_id", nullable = false)
    private UUID minorPersonId;

    @Convert(converter = PiiStringConverter.class)
    @Column(name = "full_name", nullable = false, length = 512)
    private String fullName;

    @Column(name = "document_type", nullable = false, length = 10)
    private String documentType;

    @Convert(converter = PiiStringConverter.class)
    @Column(name = "document_number", nullable = false, length = 255)
    private String documentNumber;

    @Convert(converter = PiiStringConverter.class)
    @Column(name = "email", length = 512)
    private String email;

    @Convert(converter = PiiStringConverter.class)
    @Column(name = "phone", length = 255)
    private String phone;

    @Column(name = "relationship", nullable = false, length = 30)
    private String relationship;

    @Column(name = "school_id")
    private Long schoolId;

    @Column(name = "consent_document_uri", length = 500)
    private String consentDocumentUri;

    @Column(name = "consent_document_name", length = 255)
    private String consentDocumentName;

    @Column(name = "consent_document_mime", length = 100)
    private String consentDocumentMime;

    @Column(name = "consent_document_size")
    private Long consentDocumentSize;

    @Column(name = "consent_document_uploaded_at")
    private LocalDateTime consentDocumentUploadedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
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
    private Long rowVersion;
}
