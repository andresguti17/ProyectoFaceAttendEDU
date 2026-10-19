package com.faceattend_edu.attendance_service.infrastructure.persistence.repository;

import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.AttendanceRecordJpaEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AttendanceRecordJpaRepository extends JpaRepository<AttendanceRecordJpaEntity, Long> {
    Optional<AttendanceRecordJpaEntity> findByClassSessionIdAndAcademicActorId(Long classSessionId, Long academicActorId);
    List<AttendanceRecordJpaEntity> findByClassSessionId(Long classSessionId);
    List<AttendanceRecordJpaEntity> findByAcademicActorId(Long academicActorId);

    /**
     * Listado filtrado y paginado en SQL (índices uq_attendance_session_actor e
     * idx_attendance_actor). Traer los ~81k registros con findAll y filtrar en Java
     * agotaba el heap (OutOfMemoryError). Igual que countByGroups, cada filtro se
     * activa con su bandera y el valor de un filtro apagado es de relleno.
     */
    @Query(value = """
            select r from AttendanceRecordJpaEntity r
             where r.deletedAt is null
               and (:bySession = false or r.classSessionId = :sessionId)
               and (:byActor = false or r.academicActorId = :actorId)
               and (:byStatus = false or r.attendanceStatus = :status)
               and (:byScope = false or r.academicActorId in :scopeIds)
             order by r.attendanceRecordId
            """,
            countQuery = """
            select count(r) from AttendanceRecordJpaEntity r
             where r.deletedAt is null
               and (:bySession = false or r.classSessionId = :sessionId)
               and (:byActor = false or r.academicActorId = :actorId)
               and (:byStatus = false or r.attendanceStatus = :status)
               and (:byScope = false or r.academicActorId in :scopeIds)
            """)
    Page<AttendanceRecordJpaEntity> search(@Param("bySession") boolean bySession, @Param("sessionId") long sessionId,
                                           @Param("byActor") boolean byActor, @Param("actorId") long actorId,
                                           @Param("byStatus") boolean byStatus, @Param("status") String status,
                                           @Param("byScope") boolean byScope, @Param("scopeIds") Collection<Long> scopeIds,
                                           Pageable pageable);

    /**
     * Conteo por actor y estado, agregado en SQL. Es lo que permite que una vista
     * calcule el porcentaje de asistencia de cientos de estudiantes sin descargar
     * los ~81k registros: la alternativa era traerlos todos y contarlos en el
     * cliente.
     */
    @Query("""
            select r.academicActorId as academicActorId,
                   r.attendanceStatus as attendanceStatus,
                   count(r) as total
              from AttendanceRecordJpaEntity r
             where r.academicActorId in :actorIds
               and r.deletedAt is null
             group by r.academicActorId, r.attendanceStatus
            """)
    List<ActorAttendanceCount> summarizeByActors(@Param("actorIds") Collection<Long> actorIds);

    /**
     * Conteo por sesión, actor y estado para los reportes. Cada filtro se activa con
     * su bandera; el conjunto de un filtro apagado lleva un valor de relleno.
     */
    @Query("""
            select r.classSessionId as classSessionId,
                   r.academicActorId as academicActorId,
                   r.attendanceStatus as attendanceStatus,
                   count(r) as total
              from AttendanceRecordJpaEntity r
             where r.deletedAt is null
               and (:bySessions = false or r.classSessionId in :sessionIds)
               and (:byActors = false or r.academicActorId in :actorIds)
             group by r.classSessionId, r.academicActorId, r.attendanceStatus
            """)
    List<AttendanceGroupCount> countByGroups(@Param("bySessions") boolean bySessions,
                                             @Param("sessionIds") Collection<Long> sessionIds,
                                             @Param("byActors") boolean byActors,
                                             @Param("actorIds") Collection<Long> actorIds);
}
