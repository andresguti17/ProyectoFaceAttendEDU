package com.faceattend_edu.attendance_service.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class SupportingDocument {
    private Long supportingDocumentId;
    private Long justificationId;
    private String fileName;
    private String storageUri;
    private String mimeType;
    private Long sizeBytes;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant deletedAt;
    private UUID createdBy;
    private UUID updatedBy;
    private UUID deletedBy;
    private long rowVersion;

    /** ERF 6.1: soportes PDF, JPG o PNG de hasta 5 MB. */
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("application/pdf", "image/jpeg", "image/png");
    private static final long MAX_SIZE_BYTES = 5L * 1024 * 1024;

    public void validate() {
        if (justificationId == null) throw new IllegalArgumentException("justificationId is required");
        if (isBlank(fileName)) throw new IllegalArgumentException("fileName is required");
        if (fileName.length() > 255) throw new IllegalArgumentException("fileName max 255");
        if (isBlank(storageUri)) throw new IllegalArgumentException("storageUri is required");
        if (storageUri.length() > 500) throw new IllegalArgumentException("storageUri max 500");
        if (isBlank(mimeType)) throw new IllegalArgumentException("mimeType is required");
        if (!ALLOWED_MIME_TYPES.contains(mimeType.trim().toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("mimeType must be one of application/pdf, image/jpeg, image/png");
        if (sizeBytes == null || sizeBytes <= 0) throw new IllegalArgumentException("sizeBytes must be > 0");
        if (sizeBytes > MAX_SIZE_BYTES) throw new IllegalArgumentException("sizeBytes must be <= " + MAX_SIZE_BYTES + " (5 MB)");
    }
    public void touchCreated(){ if(createdAt==null) createdAt=Instant.now(); if(rowVersion==0) rowVersion=1L; }
    public void touchUpdated() {
        updatedAt = Instant.now();
        // row_version is owned by JPA @Version (reinforced by fn_audit_timestamps trigger);
        // pre-incrementing it here makes merge() fail with StaleObjectStateException
    }
    private static boolean isBlank(String s){ return s==null || s.trim().isEmpty(); }
    @Override public boolean equals(Object o){ if(this==o) return true; if(!(o instanceof SupportingDocument)) return false; SupportingDocument that=(SupportingDocument)o; return Objects.equals(supportingDocumentId, that.supportingDocumentId); }
    @Override public int hashCode(){ return Objects.hash(supportingDocumentId); }
}
