package com.faceattend_edu.scheduling_service.infrastructure.persistence.entity;

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
@Table(name = "environment", schema = "scheduling",
        uniqueConstraints = @UniqueConstraint(name = "uq_environment_code_school", columnNames = {"school_id", "code"}))
// Borrado logico (AGENTS.md 2.2): deleteById marca la fila en vez de quitarla y las lecturas la ocultan.
// Identificadores entre comillas: valen igual en PostgreSQL (minusculas) y en el H2 de los tests.
// El indice uq_environment_code_school es parcial (deleted_at IS NULL): el codigo queda libre.
@SQLDelete(sql = "update {h-schema}\"environment\" set \"deleted_at\" = now(), \"status\" = false, \"row_version\" = \"row_version\" + 1 where \"environment_id\" = ? and \"row_version\" = ?")
@SQLRestriction("\"deleted_at\" is null")
@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class EnvironmentJpaEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "environment_id")
    private Integer environmentId;

    @Column(name = "school_id", nullable = false)
    private Integer schoolId;

    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "capacity", nullable = false)
    private Short capacity;

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

    @Version
    @Column(name = "row_version", nullable = false)
    private long rowVersion;
}
