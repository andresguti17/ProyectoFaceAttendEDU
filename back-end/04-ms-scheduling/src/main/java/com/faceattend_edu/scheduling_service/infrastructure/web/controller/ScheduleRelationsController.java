package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.model.ScheduleBlock;
import com.faceattend_edu.scheduling_service.domain.port.in.GetEnvironmentUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.ListClassSessionsUseCase;
import com.faceattend_edu.scheduling_service.domain.port.in.ListScheduleBlocksUseCase;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.ClassSessionResponse;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.ScheduleBlockResponse;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ClassSessionWebMapper;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.ScheduleBlockWebMapper;
import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ScheduleRelationsController {

    private final ListScheduleBlocksUseCase listBlocksUseCase;
    private final ListClassSessionsUseCase listSessionsUseCase;
    private final GetEnvironmentUseCase getEnvironmentUseCase;
    private final ScheduleBlockWebMapper blockMapper;
    private final ClassSessionWebMapper sessionMapper;

    /** schedule_block has no school_id of its own — it traces one through environment_id. */
    private Integer schoolOf(ScheduleBlock block) {
        if (block == null || block.getEnvironmentId() == null) return null;
        Environment environment = getEnvironmentUseCase.getById(block.getEnvironmentId());
        return environment.getSchoolId();
    }

    /**
     * Same-school predicate for an unrestricted-skip filter: Super Administrador
     * (or a test without AuthTokenFilter) sees everything, never pays for the
     * environment lookup; everyone else is confined to their own school.
     */
    private Predicate<ScheduleBlock> ownSchoolOnly() {
        if (!CallerSchoolContext.restricted()) return b -> true;
        Integer ownSchoolId = CallerSchoolContext.ownSchoolId();
        Map<Integer, Integer> schoolByEnvironment = new HashMap<>();
        // Sin sede propia: falla seguro, nada.
        if (ownSchoolId == null) return b -> false;
        return b -> ownSchoolId.equals(schoolByEnvironment.computeIfAbsent(b.getEnvironmentId(), id -> schoolOf(b)));
    }

    @GetMapping("/api/v1/cohorts/{id}/blocks")
    public ResponseEntity<List<ScheduleBlockResponse>> blocksByCohort(@PathVariable Long id) {
        Predicate<ScheduleBlock> ownSchoolOnly = ownSchoolOnly();
        return ResponseEntity.ok(listBlocksUseCase.list().stream()
                .filter(b -> id.equals(b.getCohortId()))
                .filter(ownSchoolOnly)
                .map(blockMapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/api/v1/environments/{id}/blocks")
    public ResponseEntity<List<ScheduleBlockResponse>> blocksByEnvironment(@PathVariable Integer id) {
        Predicate<ScheduleBlock> ownSchoolOnly = ownSchoolOnly();
        return ResponseEntity.ok(listBlocksUseCase.list().stream()
                .filter(b -> id.equals(b.getEnvironmentId()))
                .filter(ownSchoolOnly)
                .map(blockMapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/api/v1/actors/{id}/blocks")
    public ResponseEntity<List<ScheduleBlockResponse>> blocksByActor(@PathVariable Long id) {
        Predicate<ScheduleBlock> ownSchoolOnly = ownSchoolOnly();
        return ResponseEntity.ok(listBlocksUseCase.list().stream()
                .filter(b -> id.equals(b.getInstructorActorId()))
                .filter(ownSchoolOnly)
                .map(blockMapper::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/api/v1/blocks/{id}/sessions")
    public ResponseEntity<List<ClassSessionResponse>> sessionsByBlock(@PathVariable Long id) {
        // A session's school is its block's school; scope by checking that one block.
        if (CallerSchoolContext.restricted()) {
            ScheduleBlock block = listBlocksUseCase.list().stream()
                    .filter(b -> id.equals(b.getScheduleBlockId())).findFirst().orElse(null);
            CallerSchoolContext.requireSchool(schoolOf(block));
        }
        return ResponseEntity.ok(listSessionsUseCase.list().stream()
                .filter(s -> id.equals(s.getScheduleBlockId()))
                .map(sessionMapper::toResponse).collect(Collectors.toList()));
    }
}
