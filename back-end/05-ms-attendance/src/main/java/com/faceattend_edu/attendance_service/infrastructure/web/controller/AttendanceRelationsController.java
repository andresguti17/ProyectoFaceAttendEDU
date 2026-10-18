package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.port.in.GetAttendanceRecordUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListAttendanceRecordsUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListJustificationsUseCase;
import com.faceattend_edu.attendance_service.domain.port.in.ListSupportingDocumentsUseCase;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.AttendanceRecordResponse;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.JustificationResponse;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.SupportingDocumentResponse;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.AttendanceRecordWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.JustificationWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.SupportingDocumentWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.security.ActorScope;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class AttendanceRelationsController {

    private final ListAttendanceRecordsUseCase listRecordsUseCase;
    private final GetAttendanceRecordUseCase getRecordUseCase;
    private final ListJustificationsUseCase listJustificationsUseCase;
    private final ListSupportingDocumentsUseCase listDocumentsUseCase;
    private final AttendanceRecordWebMapper recordMapper;
    private final JustificationWebMapper justificationMapper;
    private final SupportingDocumentWebMapper documentMapper;

    @GetMapping("/api/v1/class-sessions/{id}/attendance")
    public ResponseEntity<List<AttendanceRecordResponse>> bySession(@PathVariable Long id) {
        return ResponseEntity.ok(listRecordsUseCase.search(AttendanceRecordFilter.bySession(id, ActorScope.actorIds()), 0, null)
                .items().stream().map(recordMapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/api/v1/academic-actors/{actorId}/attendance")
    public ResponseEntity<List<AttendanceRecordResponse>> byActor(@PathVariable Long actorId) {
        ActorScope.require(actorId);
        return ResponseEntity.ok(listRecordsUseCase.search(AttendanceRecordFilter.byActor(actorId), 0, null)
                .items().stream().map(recordMapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/api/v1/attendance/{id}/justification")
    public ResponseEntity<JustificationResponse> byAttendance(@PathVariable Long id) {
        requireRecord(id);
        return ResponseEntity.ok(listJustificationsUseCase.list().stream()
                .filter(j -> id.equals(j.getAttendanceRecordId()))
                .findFirst()
                .map(justificationMapper::toResponse)
                .orElse(null));
    }

    @GetMapping("/api/v1/justifications/{id}/documents")
    public ResponseEntity<List<SupportingDocumentResponse>> documentsByJustification(@PathVariable Long id) {
        if (ActorScope.restricted()) {
            requireRecord(listJustificationsUseCase.list().stream()
                    .filter(j -> id.equals(j.getJustificationId()))
                    .findFirst().map(j -> j.getAttendanceRecordId()).orElse(null));
        }
        return ResponseEntity.ok(listDocumentsUseCase.listByJustificationId(id).stream()
                .map(documentMapper::toResponse).collect(Collectors.toList()));
    }

    private void requireRecord(Long attendanceRecordId) {
        if (!ActorScope.restricted()) return;
        Long actorId = null;
        try {
            if (attendanceRecordId != null) actorId = getRecordUseCase.getById(attendanceRecordId).getAcademicActorId();
        } catch (EntityNotFoundException e) {
            // registro inexistente: igual que antes, fuera de alcance (403)
        }
        ActorScope.require(actorId);
    }
}
