package com.faceattend_edu.identity_service.adapter.out.persistence.repository;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.UserSessionJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface UserSessionJpaRepository extends JpaRepository<UserSessionJpaEntity, UUID> {
    List<UserSessionJpaEntity> findByUser_UserId(UUID userId);

    /**
     * Cierre atómico de la rotación de refresh: una sola sentencia condicionada
     * a que la sesión siga Active. Devuelve el nº de filas afectadas, de modo
     * que solo un llamador puede emitir la sesión nueva (un solo uso).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update UserSessionJpaEntity s
               set s.sessionStatus = :closedStatus,
                   s.endDate = :closedAt,
                   s.updatedAt = :closedAt
             where s.sessionId = :sessionId
               and s.sessionStatus = :activeStatus
            """)
    int closeIfActive(@Param("sessionId") UUID sessionId,
                      @Param("closedAt") LocalDateTime closedAt,
                      @Param("activeStatus") String activeStatus,
                      @Param("closedStatus") String closedStatus);
}
