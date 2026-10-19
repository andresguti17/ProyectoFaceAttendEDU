package com.faceattend_edu.attendance_service.infrastructure.persistence;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import com.faceattend_edu.attendance_service.infrastructure.persistence.adapter.AttendanceRecordPersistenceAdapter;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.AttendanceRecordJpaEntity;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.AttendanceRecordPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Listado de registros filtrado y paginado en SQL contra H2: antes se traía la
 * tabla completa con findAll y se filtraba en Java (OutOfMemoryError con ~81k filas).
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
@Import({AttendanceRecordPersistenceAdapter.class, AttendanceRecordPersistenceMapper.class})
@DisplayName("Attendance record search in SQL")
class AttendanceRecordSearchTest {

    @Autowired
    private AttendanceRecordJpaRepository repository;

    @Autowired
    private AttendanceRecordPersistenceAdapter adapter;

    private final List<Long> ids = new java.util.ArrayList<>();

    private void record(long session, long actor, String status, Instant deletedAt) {
        AttendanceRecordJpaEntity e = new AttendanceRecordJpaEntity();
        e.setClassSessionId(session);
        e.setAcademicActorId(actor);
        e.setAttendanceStatus(status);
        e.setCaptureMethod("MANUAL");
        e.setCreatedAt(Instant.now());
        e.setDeletedAt(deletedAt);
        ids.add(repository.save(e).getAttendanceRecordId());
    }

    @BeforeEach
    void seed() {
        record(1L, 10L, "Present", null);   // ids[0]
        record(1L, 11L, "Absent", null);    // ids[1]
        record(2L, 10L, "Late", null);      // ids[2]
        record(2L, 11L, "Present", null);   // ids[3]
        record(3L, 12L, "Absent", null);    // ids[4]
        record(3L, 10L, "Absent", Instant.now()); // borrado lógico: nunca aparece
        repository.flush();
    }

    private List<Long> idsOf(AttendanceRecordSlice slice) {
        return slice.items().stream().map(AttendanceRecord::getAttendanceRecordId).toList();
    }

    @Test
    @DisplayName("sin filtros pagina por id con offset arbitrario y cuenta el total")
    void pagesWithArbitraryOffset() {
        AttendanceRecordSlice slice = adapter.search(new AttendanceRecordFilter(null, null, null, null), 1, 2);

        assertEquals(List.of(ids.get(1), ids.get(2)), idsOf(slice));
        assertEquals(5, slice.total());
    }

    @Test
    @DisplayName("combina sesión, actor y estado")
    void combinesFilters() {
        assertEquals(List.of(ids.get(2), ids.get(3)), idsOf(adapter.search(new AttendanceRecordFilter(2L, null, null, null), 0, null)));
        assertEquals(List.of(ids.get(0), ids.get(2)), idsOf(adapter.search(AttendanceRecordFilter.byActor(10L), 0, null)));
        assertEquals(List.of(ids.get(1), ids.get(4)), idsOf(adapter.search(new AttendanceRecordFilter(null, null, "Absent", null), 0, null)));
    }

    @Test
    @DisplayName("el alcance del llamante limita los actores y un alcance vacío no ve nada")
    void appliesCallerScope() {
        AttendanceRecordSlice scoped = adapter.search(new AttendanceRecordFilter(null, null, null, Set.of(11L, 12L)), 0, 100);
        assertEquals(List.of(ids.get(1), ids.get(3), ids.get(4)), idsOf(scoped));
        assertEquals(3, scoped.total());

        AttendanceRecordSlice none = adapter.search(new AttendanceRecordFilter(null, null, null, Set.of()), 0, 100);
        assertEquals(0, none.total());
    }
}
