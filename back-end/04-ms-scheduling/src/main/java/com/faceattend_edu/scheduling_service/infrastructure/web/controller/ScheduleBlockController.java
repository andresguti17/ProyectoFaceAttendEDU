package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.in.*;
import com.faceattend_edu.scheduling_service.infrastructure.web.Paging;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.*;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ScheduleBlockWebMapper;
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
@RequestMapping({"/api/v1/schedule-blocks", "/schedule-blocks"})
@RequiredArgsConstructor
public class ScheduleBlockController {

    private final CreateScheduleBlockUseCase createUseCase;
    private final UpdateScheduleBlockUseCase updateUseCase;
    private final GetScheduleBlockUseCase getUseCase;
    private final ListScheduleBlocksUseCase listUseCase;
    private final DeleteScheduleBlockUseCase deleteUseCase;
    private final GetEnvironmentUseCase getEnvironmentUseCase;
    private final ScheduleBlockWebMapper mapper;

    /** schedule_block has no school_id of its own — it traces one through environment_id. */
    private Integer schoolOf(ScheduleBlock block) {
        if (block == null || block.getEnvironmentId() == null) return null;
        Environment environment = getEnvironmentUseCase.getById(block.getEnvironmentId());
        return environment.getSchoolId();
    }

    /** Skips the environment_id -> schoolId lookup entirely for an unrestricted caller (Super Administrador). */
    private void requireAccess(ScheduleBlock block) {
        if (CallerSchoolContext.restricted()) CallerSchoolContext.requireSchool(schoolOf(block));
    }

    @GetMapping
    public ResponseEntity<List<ScheduleBlockResponse>> list(
            @RequestParam(required = false) Long cohortId,
            @RequestParam(required = false) Integer environmentId,
            @RequestParam(required = false) Long instructorActorId,
            @RequestParam(required = false) Integer courseId,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset) {
        boolean restricted = CallerSchoolContext.restricted();
        Integer ownSchoolId = restricted ? CallerSchoolContext.ownSchoolId() : null;
        // Memoiza environmentId -> schoolId: varios bloques comparten el mismo
        // ambiente, y schoolOf() hace una consulta por bloque.
        Map<Integer, Integer> schoolByEnvironment = new HashMap<>();
        List<ScheduleBlockResponse> list = listUseCase.list().stream()
                .filter(b -> cohortId == null || cohortId.equals(b.getCohortId()))
                .filter(b -> environmentId == null || environmentId.equals(b.getEnvironmentId()))
                .filter(b -> instructorActorId == null || instructorActorId.equals(b.getInstructorActorId()))
                .filter(b -> courseId == null || courseId.equals(b.getCourseId()))
                // Sin sede propia (restricted && ownSchoolId == null): falla seguro, nada.
                .filter(b -> !restricted || (ownSchoolId != null
                        && ownSchoolId.equals(schoolByEnvironment.computeIfAbsent(b.getEnvironmentId(), id -> schoolOf(b)))))
                .map(mapper::toResponse).collect(Collectors.toList());
        return Paging.slice(list, limit, offset);
    }

    @PostMapping
    public ResponseEntity<ScheduleBlockResponse> create(@Valid @RequestBody CreateScheduleBlockRequest req) {
        ScheduleBlock domain = mapper.toDomain(req);
        requireAccess(domain);
        ScheduleBlock created = createUseCase.create(domain);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ScheduleBlockResponse> get(@PathVariable Long id) {
        ScheduleBlock found = getUseCase.getById(id);
        requireAccess(found);
        return ResponseEntity.ok(mapper.toResponse(found));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ScheduleBlockResponse> update(@PathVariable Long id, @Valid @RequestBody UpdateScheduleBlockRequest req) {
        ScheduleBlock found = getUseCase.getById(id);
        requireAccess(found);
        ScheduleBlock patch = mapper.toDomain(req);
        if (patch.getEnvironmentId() != null) requireAccess(patch);
        ScheduleBlock updated = updateUseCase.update(id, patch);
        return ResponseEntity.ok(mapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        ScheduleBlock found = getUseCase.getById(id);
        requireAccess(found);
        deleteUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }
}
