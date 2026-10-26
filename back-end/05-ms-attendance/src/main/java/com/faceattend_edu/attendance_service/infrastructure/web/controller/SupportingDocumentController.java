package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.*;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.*;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/supporting-documents", "/supporting-documents"})
@RequiredArgsConstructor
public class SupportingDocumentController {
    private final GetSupportingDocumentUseCase getUseCase;
    private final ListSupportingDocumentsUseCase listUseCase;
    private final DeleteSupportingDocumentUseCase deleteUseCase;
    private final SupportingDocumentWebMapper mapper;
    private final GetJustificationUseCase justificationUseCase;
    private final GetAttendanceRecordUseCase recordUseCase;
    private final GetSupportingDocumentContentUseCase contentUseCase;

    /**
     * Documents of one justification. The filter is mandatory: listing every document meant
     * loading the whole table and resolving each row's record to decide who could see it.
     */
    @GetMapping
    public ResponseEntity<List<SupportingDocumentResponse>> list(@RequestParam Long justificationId){
        requireJustification(justificationId);
        return ResponseEntity.ok(listUseCase.listByJustificationId(justificationId).stream()
                .map(mapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupportingDocumentResponse> get(@PathVariable Long id){
        SupportingDocument document = getUseCase.getById(id);
        requireJustification(document.getJustificationId());
        return ResponseEntity.ok(mapper.toResponse(document));
    }

    /** The stored file, for the reviewer (and the owner) to open from the app. */
    @GetMapping("/{id}/content")
    public ResponseEntity<byte[]> content(@PathVariable Long id){
        requireJustification(getUseCase.getById(id).getJustificationId());
        GetSupportingDocumentContentUseCase.DocumentContent content = contentUseCase.getContent(id);
        SupportingDocument doc = content.document();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(doc.getMimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(doc.getFileName(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(content.bytes());
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
