package com.faceattend_edu.identity_service.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "person", schema = "identity",
        uniqueConstraints = @UniqueConstraint(name = "uq_person_document", columnNames = {"document_type", "document_number"}))
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PersonJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "person_id")
    private UUID personId;

    @Column(name = "document_number", nullable = false, length = 50)
    private String documentNumber;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "email")
    private String email;

    @Column(name = "phone", length = 50)
    private String phone;

    @Column(name = "document_type", length = 10)
    private String documentType;

    @Column(name = "blood_type", length = 5)
    private String bloodType;

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
}
