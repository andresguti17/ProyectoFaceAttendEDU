package com.faceattend_edu.attendance_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "supporting_document", schema = "attendance",
        indexes = @Index(name = "idx_document_justification", columnList = "justification_id"))
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class SupportingDocumentJpaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "supporting_document_id")
    private Long supportingDocumentId;

    @Column(name = "justification_id", nullable = false)
    private Long justificationId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "storage_uri", nullable = false, length = 500)
    private String storageUri;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    @Column(name = "deleted_at")
    private Instant deletedAt;
    @Column(name = "created_by")
    private UUID createdBy;
    @Column(name = "updated_by")
    private UUID updatedBy;
    @Column(name = "deleted_by")
    private UUID deletedBy;
    @Version @Column(name = "row_version", nullable = false)
    private long rowVersion;
}
