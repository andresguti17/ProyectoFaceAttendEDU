package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.model.JustificationFilter;
import com.faceattend_edu.attendance_service.domain.model.JustificationSlice;
import com.faceattend_edu.attendance_service.domain.port.in.*;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.*;
import com.faceattend_edu.attendance_service.infrastructure.web.Paging;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.JustificationWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/justifications", "/justifications"})
@RequiredArgsConstructor
public class JustificationController {
    private final CreateJustificationUseCase createUseCase;
    private final ReviewJustificationUseCase reviewUseCase;
    private final GetJustificationUseCase getUseCase;
    private final ListJustificationsUseCase listUseCase;
    private final DeleteJustificationUseCase deleteUseCase;
    private final JustificationWebMapper mapper;
    private final GetAttendanceRecordUseCase recordUseCase;

    @GetMapping
    public ResponseEntity<List<JustificationResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long attendanceRecordId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset){
        // Filtros, alcance y paginación en SQL: antes se cargaba la tabla entera y se
        // consultaba el registro de cada fila para decidir si el llamante podía verla.
        boolean paged = limit != null || offset != null;
        JustificationSlice slice = listUseCase.search(
                new JustificationFilter(status, attendanceRecordId, ActorScope.actorIds()),
                Paging.offsetOf(offset), paged ? Paging.limitOf(limit) : null);
        List<JustificationResponse> body = slice.items().stream().map(mapper::toResponse).collect(Collectors.toList());
        return paged
                ? ResponseEntity.ok().header("X-Total-Count", String.valueOf(slice.total())).body(body)
                : ResponseEntity.ok(body);
    }

    @PostMapping
    public ResponseEntity<JustificationResponse> create(@Valid @RequestBody CreateJustificationRequest req){
        // Un aprendiz solo justifica sus propias inasistencias.
        requireRecord(req.getAttendanceRecordId());
        Justification created = createUseCase.create(mapper.toDomain(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<JustificationResponse> get(@PathVariable Long id){
        Justification justification = getUseCase.getById(id);
        requireRecord(justification.getAttendanceRecordId());
        return ResponseEntity.ok(mapper.toResponse(justification));
    }

    @PatchMapping("/{id}/review")
    public ResponseEntity<JustificationResponse> review(@PathVariable Long id, @Valid @RequestBody ReviewJustificationRequest req,
                                                        @RequestAttribute(name = "X-User-Id", required = false) Object caller){
        if (ActorScope.restricted()) requireRecord(getUseCase.getById(id).getAttendanceRecordId());
        // The reviewer is whoever holds the session (set by AuthTokenFilter); the body's
        // reviewedBy is ignored so nobody can sign a decision in someone else's name.
        UUID reviewer = caller == null ? null : UUID.fromString(String.valueOf(caller));
        Justification reviewed = reviewUseCase.review(id, req.getReviewStatus(), reviewer, req.getResolutionNotes());
        return ResponseEntity.ok(mapper.toResponse(reviewed));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id){
        if (ActorScope.restricted()) requireRecord(getUseCase.getById(id).getAttendanceRecordId());
        deleteUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** Sin alcance (administrador) todo es visible; si no, el actor del registro debe estar en él. */
    private boolean allowsRecord(Long attendanceRecordId) {
        if (!ActorScope.restricted()) return true;
        if (attendanceRecordId == null) return false;
        return ActorScope.allows(recordUseCase.getById(attendanceRecordId).getAcademicActorId());
    }

    private void requireRecord(Long attendanceRecordId) {
        if (!allowsRecord(attendanceRecordId)) throw new ActorScope.ScopeForbiddenException();
    }
}
