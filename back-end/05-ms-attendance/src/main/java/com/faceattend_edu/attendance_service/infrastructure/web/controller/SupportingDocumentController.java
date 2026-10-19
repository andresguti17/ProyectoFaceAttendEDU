package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.*;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.*;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/supporting-documents", "/supporting-documents"})
@RequiredArgsConstructor
public class SupportingDocumentController {
    private final CreateSupportingDocumentUseCase createUseCase;
    private final GetSupportingDocumentUseCase getUseCase;
    private final ListSupportingDocumentsUseCase listUseCase;
    private final DeleteSupportingDocumentUseCase deleteUseCase;
    private final SupportingDocumentWebMapper mapper;
    private final GetJustificationUseCase justificationUseCase;
    private final GetAttendanceRecordUseCase recordUseCase;

    @GetMapping
    public ResponseEntity<List<SupportingDocumentResponse>> list(@RequestParam(required = false) Long justificationId){
        List<SupportingDocument> list;
        if (justificationId != null) list = listUseCase.listByJustificationId(justificationId);
        else list = listUseCase.list();
        return ResponseEntity.ok(list.stream()
                .filter(d -> allowsJustification(d.getJustificationId()))
                .map(mapper::toResponse).collect(Collectors.toList()));
    }

    @PostMapping
    public ResponseEntity<SupportingDocumentResponse> create(@Valid @RequestBody CreateSupportingDocumentRequest req){
        requireJustification(req.getJustificationId());
        SupportingDocument created = createUseCase.create(mapper.toDomain(req));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupportingDocumentResponse> get(@PathVariable Long id){
        SupportingDocument document = getUseCase.getById(id);
        requireJustification(document.getJustificationId());
        return ResponseEntity.ok(mapper.toResponse(document));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id){
        if (ActorScope.restricted()) requireJustification(getUseCase.getById(id).getJustificationId());
        deleteUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }

    /** El soporte hereda el alcance del registro de asistencia de su justificación. */
    private boolean allowsJustification(Long justificationId) {
        if (!ActorScope.restricted()) return true;
        if (justificationId == null) return false;
        Long recordId = justificationUseCase.getById(justificationId).getAttendanceRecordId();
        return recordId != null && ActorScope.allows(recordUseCase.getById(recordId).getAcademicActorId());
    }

    private void requireJustification(Long justificationId) {
        if (!allowsJustification(justificationId)) throw new ActorScope.ScopeForbiddenException();
    }
}
