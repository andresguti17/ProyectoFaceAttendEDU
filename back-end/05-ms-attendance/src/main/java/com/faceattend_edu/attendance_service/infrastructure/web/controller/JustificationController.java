package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.model.Justification;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
        Map<Long, Boolean> visibleRecords = new HashMap<>();
        List<JustificationResponse> list = listUseCase.list().stream()
                .filter(j -> visibleRecords.computeIfAbsent(j.getAttendanceRecordId(), this::allowsRecord))
                .filter(j -> status == null || status.equals(j.getReviewStatus()))
                .filter(j -> attendanceRecordId == null || attendanceRecordId.equals(j.getAttendanceRecordId()))
                .map(mapper::toResponse).collect(Collectors.toList());
        return Paging.slice(list, limit, offset);
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
    public ResponseEntity<JustificationResponse> review(@PathVariable Long id, @Valid @RequestBody ReviewJustificationRequest req){
        if (ActorScope.restricted()) requireRecord(getUseCase.getById(id).getAttendanceRecordId());
        Justification reviewed = reviewUseCase.review(id, req.getReviewStatus(), req.getReviewedBy(), req.getResolutionNotes());
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
