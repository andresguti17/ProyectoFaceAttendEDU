package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.port.in.*;
import com.faceattend_edu.attendance_service.infrastructure.web.dto.*;
import com.faceattend_edu.attendance_service.infrastructure.web.mapper.JustificationTypeWebMapper;
import com.faceattend_edu.attendance_service.infrastructure.web.security.CallerSchoolContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/justification-types", "/justification-types"})
@RequiredArgsConstructor
public class JustificationTypeController {
    private final CreateJustificationTypeUseCase createUseCase;
    private final UpdateJustificationTypeUseCase updateUseCase;
    private final GetJustificationTypeUseCase getUseCase;
    private final ListJustificationTypesUseCase listUseCase;
    private final DeleteJustificationTypeUseCase deleteUseCase;
    private final JustificationTypeWebMapper mapper;

    @GetMapping
    public ResponseEntity<List<JustificationTypeResponse>> list(){
        // Global (school_id NULL) es de todos; uno propio de sede solo lo ve esa
        // sede (y Super Administrador) — nunca el catálogo privado de otra.
        List<JustificationTypeResponse> list = listUseCase.list().stream()
                .filter(t -> CallerSchoolContext.allowsType(t.getSchoolId()))
                .map(mapper::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<JustificationTypeResponse> create(@Valid @RequestBody CreateJustificationTypeRequest req){
        JustificationType domain = mapper.toDomain(req);
        // Un Administrador de sede nunca crea el catálogo global, ni el de otra sede.
        CallerSchoolContext.requireOwnOrGlobalWrite(domain.getSchoolId());
        JustificationType created = createUseCase.create(domain);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<JustificationTypeResponse> get(@PathVariable Integer id){
        JustificationType found = getUseCase.getById(id);
        CallerSchoolContext.requireType(found.getSchoolId());
        return ResponseEntity.ok(mapper.toResponse(found));
    }

    @PutMapping("/{id}")
    public ResponseEntity<JustificationTypeResponse> update(@PathVariable Integer id, @Valid @RequestBody UpdateJustificationTypeRequest req){
        JustificationType found = getUseCase.getById(id);
        CallerSchoolContext.requireOwnOrGlobalWrite(found.getSchoolId());
        JustificationType patch = mapper.toDomain(req);
        // A non-null schoolId in the patch is a request to move the type: also
        // confined to the caller's own school (never another, never global).
        if (patch.getSchoolId() != null) CallerSchoolContext.requireOwnOrGlobalWrite(patch.getSchoolId());
        JustificationType updated = updateUseCase.update(id, patch);
        return ResponseEntity.ok(mapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id){
        JustificationType found = getUseCase.getById(id);
        CallerSchoolContext.requireOwnOrGlobalWrite(found.getSchoolId());
        deleteUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }
}
