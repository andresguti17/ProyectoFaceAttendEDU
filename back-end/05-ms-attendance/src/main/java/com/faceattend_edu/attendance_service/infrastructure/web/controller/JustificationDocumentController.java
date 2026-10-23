package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.exception.ValidationException;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.GetJustificationUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.UploadSupportingDocumentUseCase;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.SupportingDocumentResponse;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** Upload of the supporting document itself (multipart), stored in MinIO. */
@RestController
@RequiredArgsConstructor
public class JustificationDocumentController {

    private final UploadSupportingDocumentUseCase uploadUseCase;
    private final GetJustificationUseCase justificationUseCase;
    private final GetAttendanceRecordUseCase recordUseCase;
    private final SupportingDocumentWebMapper mapper;

    @PostMapping(path = "/api/v1/justifications/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SupportingDocumentResponse> upload(@PathVariable Long id,
                                                             @RequestParam("file") MultipartFile file) throws IOException {
        // Same scope as the justification: an apprentice only attaches to their own absences.
        if (ActorScope.restricted()) {
            Long recordId = justificationUseCase.getById(id).getAttendanceRecordId();
            ActorScope.require(recordId == null ? null : recordUseCase.getById(recordId).getAcademicActorId());
        }
        if (file == null || file.isEmpty()) throw new ValidationException("file is required");
        SupportingDocument saved = uploadUseCase.upload(id, file.getOriginalFilename(), file.getBytes());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(saved));
    }
}
