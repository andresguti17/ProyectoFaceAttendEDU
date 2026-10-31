package com.faceattend_edu.attendance_service.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "justification_type", schema = "attendance",
        uniqueConstraints = @UniqueConstraint(name = "uq_justification_type_school_name", columnNames = {"school_id", "name"}),
        indexes = @Index(name = "idx_justification_type_school", columnList = "school_id"))
// Borrado logico (AGENTS.md 2.2): deleteById marca la fila en vez de quitarla y las lecturas la ocultan.
// Identificadores entre comillas: valen igual en PostgreSQL (minusculas) y en el H2 de los tests.
// Los indices uq_justification_type_* son parciales (deleted_at IS NULL): el nombre queda libre.
@SQLDelete(sql = "update {h-schema}\"justification_type\" set \"deleted_at\" = now(), \"status\" = false, \"row_version\" = \"row_version\" + 1 where \"justification_type_id\" = ? and \"row_version\" = ?")
@SQLRestriction("\"deleted_at\" is null")
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class JustificationTypeJpaEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "justification_type_id")
    private Integer justificationTypeId;

    @Column(name = "school_id")
    private Integer schoolId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "requires_attachment", nullable = false)
    private Boolean requiresAttachment;

    @Column(name = "status", nullable = false)
    private Boolean status;

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
