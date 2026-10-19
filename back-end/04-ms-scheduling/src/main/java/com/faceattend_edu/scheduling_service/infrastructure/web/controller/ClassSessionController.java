package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.model.ClassSession;
import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.in.*;
import com.faceattend_edu.scheduling_service.infrastructure.web.Paging;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.*;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ClassSessionWebMapper;
import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolContext;
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
@RequestMapping({"/api/v1/class-sessions", "/class-sessions"})
@RequiredArgsConstructor
public class ClassSessionController {

    private final CreateClassSessionUseCase createUseCase;
    private final UpdateClassSessionUseCase updateUseCase;
    private final GetClassSessionUseCase getUseCase;
    private final ListClassSessionsUseCase listUseCase;
    private final DeleteClassSessionUseCase deleteUseCase;
    private final OpenClassSessionUseCase openUseCase;
    private final CloseClassSessionUseCase closeUseCase;
    private final CancelClassSessionUseCase cancelUseCase;
    private final GetScheduleBlockUseCase getScheduleBlockUseCase;
    private final GetEnvironmentUseCase getEnvironmentUseCase;
    private final ClassSessionWebMapper mapper;

    /** class_session has no school_id either — it traces one through schedule_block -> environment. */
    private Integer schoolOf(ClassSession session) {
        if (session == null || session.getScheduleBlockId() == null) return null;
        ScheduleBlock block = getScheduleBlockUseCase.getById(session.getScheduleBlockId());
        if (block.getEnvironmentId() == null) return null;
        Environment environment = getEnvironmentUseCase.getById(block.getEnvironmentId());
        return environment.getSchoolId();
    }

    /** Skips the two-hop schedule_block/environment lookup entirely for an unrestricted caller. */
    private void requireAccess(ClassSession session) {
        if (CallerSchoolContext.restricted()) CallerSchoolContext.requireSchool(schoolOf(session));
    }

    @GetMapping
    public ResponseEntity<List<ClassSessionResponse>> list(
            @RequestParam(required = false) Long scheduleBlockId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset) {
        boolean restricted = CallerSchoolContext.restricted();
        Integer ownSchoolId = restricted ? CallerSchoolContext.ownSchoolId() : null;
        Map<Long, Integer> schoolByBlock = new HashMap<>();
        List<ClassSessionResponse> list = listUseCase.list().stream()
                .filter(s -> scheduleBlockId == null || scheduleBlockId.equals(s.getScheduleBlockId()))
                // Sin sede propia (restricted && ownSchoolId == null): falla seguro, nada.
                .filter(s -> !restricted || (ownSchoolId != null
                        && ownSchoolId.equals(schoolByBlock.computeIfAbsent(s.getScheduleBlockId(), id -> schoolOf(s)))))
                .map(mapper::toResponse).collect(Collectors.toList());
        return Paging.slice(list, limit, offset);
    }

    @PostMapping
    public ResponseEntity<ClassSessionResponse> create(@Valid @RequestBody CreateClassSessionRequest req) {
        ClassSession domain = mapper.toDomain(req);
        requireAccess(domain);
        ClassSession created = createUseCase.create(domain);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassSessionResponse> get(@PathVariable Long id) {
        ClassSession found = getUseCase.getById(id);
        requireAccess(found);
        return ResponseEntity.ok(mapper.toResponse(found));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClassSessionResponse> update(@PathVariable Long id, @Valid @RequestBody UpdateClassSessionRequest req) {
        ClassSession found = getUseCase.getById(id);
        requireAccess(found);
        ClassSession patch = mapper.toDomain(req);
        if (patch.getScheduleBlockId() != null) requireAccess(patch);
        ClassSession updated = updateUseCase.update(id, patch);
        return ResponseEntity.ok(mapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ClassSession found = getUseCase.getById(id);
        requireAccess(found);
        deleteUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/open")
    public ResponseEntity<ClassSessionResponse> open(@PathVariable Long id) {
        ClassSession found = getUseCase.getById(id);
        requireAccess(found);
        // openedBy nunca viene del cliente (se podía falsificar): es el propio
        // academic_actor de quien llama, resuelto por el filtro de autenticación.
        ClassSession opened = openUseCase.open(id, CallerSchoolContext.ownActorId());
        return ResponseEntity.ok(mapper.toResponse(opened));
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<ClassSessionResponse> close(@PathVariable Long id) {
        ClassSession found = getUseCase.getById(id);
        requireAccess(found);
        // closedBy: mismo criterio que open() — nunca confiar en el cliente.
        ClassSession closed = closeUseCase.close(id, CallerSchoolContext.ownActorId());
        return ResponseEntity.ok(mapper.toResponse(closed));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<ClassSessionResponse> cancel(@PathVariable Long id) {
        ClassSession found = getUseCase.getById(id);
        requireAccess(found);
        ClassSession cancelled = cancelUseCase.cancel(id);
        return ResponseEntity.ok(mapper.toResponse(cancelled));
    }
}
