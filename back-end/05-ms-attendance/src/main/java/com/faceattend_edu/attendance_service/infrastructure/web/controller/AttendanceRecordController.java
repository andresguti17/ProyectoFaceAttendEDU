package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import com.faceattend_edu.attendance_service.domain.port.in.*;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.*;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.ActorAttendanceCount;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import com.faceattend_edu.attendance_service.infrastructure.web.Paging;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.AttendanceRecordWebMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/attendance-records", "/attendance-records"})
@RequiredArgsConstructor
public class AttendanceRecordController {
    private final CreateAttendanceRecordUseCase createUseCase;
    private final UpdateAttendanceRecordUseCase updateUseCase;
    private final GetAttendanceRecordUseCase getUseCase;
    private final ListAttendanceRecordsUseCase listUseCase;
    private final DeleteAttendanceRecordUseCase deleteUseCase;
    private final BulkRecordAttendanceUseCase bulkUseCase;
    private final AttendanceRecordWebMapper mapper;
    private final AttendanceRecordJpaRepository recordRepository;

    /** Mantiene la query string dentro de cualquier límite razonable de URL. */
    private static final int MAX_SUMMARY_ACTORS = 300;

    /**
     * Resumen por actor, agregado en SQL. Sin esto una vista que quisiera el
     * porcentaje de asistencia de sus estudiantes tenía que pedir /attendance-records
     * entero (~81k filas) y contarlo en el cliente; en la práctica nadie lo pedía y
     * los informes salían todos en 0 %.
     */
    @GetMapping("/summary")
    public ResponseEntity<Map<String, AttendanceSummaryResponse>> summary(
            @RequestParam(name = "academicActorIds", required = false) List<Long> academicActorIds) {
        if (academicActorIds == null || academicActorIds.isEmpty()) return ResponseEntity.ok(Map.of());
        if (academicActorIds.size() > MAX_SUMMARY_ACTORS) {
            throw new IllegalArgumentException(
                    "academicActorIds accepts at most " + MAX_SUMMARY_ACTORS + " ids per request");
        }

        Map<String, AttendanceSummaryResponse> body = new LinkedHashMap<>();
        Set<Long> visible = academicActorIds.stream().filter(ActorScope::allows).collect(Collectors.toSet());
        if (visible.isEmpty()) return ResponseEntity.ok(body);
        for (ActorAttendanceCount row : recordRepository.summarizeByActors(visible)) {
            AttendanceSummaryResponse summary =
                    body.computeIfAbsent(String.valueOf(row.getAcademicActorId()), key -> new AttendanceSummaryResponse());
            long count = row.getTotal();
            switch (row.getAttendanceStatus()) {
                case "Present" -> summary.setPresent(count);
                case "Late" -> summary.setLate(count);
                case "Absent" -> summary.setAbsent(count);
                case "Justified" -> summary.setJustified(count);
                default -> { }
            }
            summary.setTotal(summary.getTotal() + count);
        }
        return ResponseEntity.ok(body);
    }

    @GetMapping
    public ResponseEntity<List<AttendanceRecordResponse>> list(
            @RequestParam(required = false) Long classSessionId,
            @RequestParam(required = false) Long academicActorId,
            @RequestParam(required = false) String attendanceStatus,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset){
        // Filtros, alcance y paginación van a SQL. Sin filtro de sesión o actor y sin ?limit la
        // respuesta era la tabla entera (~81k filas, OutOfMemoryError): se pagina por defecto.
        boolean unbounded = limit == null && offset == null && (classSessionId != null || academicActorId != null);
        AttendanceRecordSlice slice = listUseCase.search(
                new AttendanceRecordFilter(classSessionId, academicActorId, attendanceStatus, ActorScope.actorIds()),
                Paging.offsetOf(offset), unbounded ? null : Paging.limitOf(limit));
        List<AttendanceRecordResponse> body = slice.items().stream().map(mapper::toResponse).collect(Collectors.toList());
        if (unbounded) return ResponseEntity.ok(body);
        return ResponseEntity.ok().header("X-Total-Count", String.valueOf(slice.total())).body(body);
    }

    @PostMapping
    public ResponseEntity<AttendanceRecordResponse> create(@Valid @RequestBody CreateAttendanceRecordRequest req){
        ActorScope.require(req.getAcademicActorId());
        AttendanceRecord created = createUseCase.create(mapper.toDomain(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(created));
    }

    @PostMapping("/bulk")
    public ResponseEntity<List<AttendanceRecordResponse>> bulk(@Valid @RequestBody List<CreateAttendanceRecordRequest> reqs){
        reqs.forEach(r -> ActorScope.require(r.getAcademicActorId()));
        List<AttendanceRecord> domains = reqs.stream().map(mapper::toDomain).collect(Collectors.toList());
        List<AttendanceRecordResponse> saved = bulkUseCase.bulk(domains).stream().map(mapper::toResponse).collect(Collectors.toList());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/{id}")
    public ResponseEntity<AttendanceRecordResponse> get(@PathVariable Long id){
        AttendanceRecord record = getUseCase.getById(id);
        ActorScope.require(record.getAcademicActorId());
        return ResponseEntity.ok(mapper.toResponse(record));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AttendanceRecordResponse> update(@PathVariable Long id, @Valid @RequestBody UpdateAttendanceRecordRequest req){
        requireRecord(id);
        AttendanceRecord updated = updateUseCase.update(id, mapper.toDomain(req));
        return ResponseEntity.ok(mapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id){
        requireRecord(id);
        deleteUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }

    private void requireRecord(Long id) {
        if (ActorScope.restricted()) ActorScope.require(getUseCase.getById(id).getAcademicActorId());
    }
}
