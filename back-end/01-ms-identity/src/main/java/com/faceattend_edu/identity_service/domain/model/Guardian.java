package com.faceattend_edu.identity_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/** Legal guardian (acudiente) of a minor learner, registered by the school administrator. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Guardian {
    private UUID guardianId;
    private UUID minorPersonId;
    private String fullName;
    private String documentType;
    private String documentNumber;
    private String email;
    private String phone;
    private String relationship;
    private Long schoolId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private UUID createdBy;
    private UUID updatedBy;
    /** Signed authorization of the guardian (MinIO): where it is and what it is. Null until uploaded. */
    private String consentDocumentUri;
    private String consentDocumentName;
    private String consentDocumentMime;
    private Long consentDocumentSize;
    private LocalDateTime consentDocumentUploadedAt;

    public boolean hasConsentDocument() {
        return consentDocumentUri != null && !consentDocumentUri.isBlank();
    }
}
