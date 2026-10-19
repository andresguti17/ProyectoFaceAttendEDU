package com.faceattend_edu.identity_service.adapter.out.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_session", schema = "identity")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserSessionJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "session_id")
    private UUID sessionId;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private UserJpaEntity user;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date")
    private LocalDateTime endDate;

    @Column(name = "source_ip", length = 45)
    private String sourceIp;

    // ENUM nativo de Postgres: se escribe como String y el driver lo coerciona (stringtype=unspecified).
    @Column(name = "session_status", nullable = false, columnDefinition = "identity.user_session_status")
    private String sessionStatus;

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

    @Column(name = "row_version", nullable = false, insertable = false, updatable = false)
    private Long rowVersion;
}
