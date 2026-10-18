package com.faceattend_edu.scheduling_service.infrastructure.web.controller;

import com.faceattend_edu.scheduling_service.domain.model.Environment;
import com.faceattend_edu.scheduling_service.domain.port.in.*;
import com.faceattend_edu.scheduling_service.infrastructure.web.dto.*;
import com.faceattend_edu.scheduling_service.infrastructure.web.mapper.EnvironmentWebMapper;
import com.faceattend_edu.scheduling_service.infrastructure.web.security.CallerSchoolContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/environments", "/environments"})
@RequiredArgsConstructor
public class EnvironmentController {

    private final CreateEnvironmentUseCase createUseCase;
    private final UpdateEnvironmentUseCase updateUseCase;
    private final GetEnvironmentUseCase getUseCase;
    private final ListEnvironmentsUseCase listUseCase;
    private final DeleteEnvironmentUseCase deleteUseCase;
    private final EnvironmentWebMapper mapper;

    @GetMapping
    public ResponseEntity<List<EnvironmentResponse>> list(@RequestParam(required = false) Integer schoolId) {
        // Administrador/Instructor/Aprendiz: siempre su propia sede, sin importar lo
        // que pida la query — Super Administrador puede filtrar por cualquiera (o ninguna).
        List<Environment> list;
        if (CallerSchoolContext.restricted()) {
            Integer ownSchoolId = CallerSchoolContext.ownSchoolId();
            // Sin sede propia: falla seguro (nada), nunca cae a la lista completa.
            list = ownSchoolId != null ? listUseCase.listBySchoolId(ownSchoolId) : List.of();
        } else {
            list = schoolId != null ? listUseCase.listBySchoolId(schoolId) : listUseCase.list();
        }
        return ResponseEntity.ok(list.stream().map(mapper::toResponse).collect(Collectors.toList()));
    }

    @PostMapping
    public ResponseEntity<EnvironmentResponse> create(@Valid @RequestBody CreateEnvironmentRequest req) {
        Environment domain = mapper.toDomain(req);
        CallerSchoolContext.requireSchool(domain.getSchoolId());
        Environment created = createUseCase.create(domain);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EnvironmentResponse> get(@PathVariable Integer id) {
        Environment found = getUseCase.getById(id);
        CallerSchoolContext.requireSchool(found.getSchoolId());
        return ResponseEntity.ok(mapper.toResponse(found));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EnvironmentResponse> update(@PathVariable Integer id, @Valid @RequestBody UpdateEnvironmentRequest req) {
        Environment found = getUseCase.getById(id);
        CallerSchoolContext.requireSchool(found.getSchoolId());
        Environment patch = mapper.toDomain(req);
        if (patch.getSchoolId() != null) CallerSchoolContext.requireSchool(patch.getSchoolId());
        Environment updated = updateUseCase.update(id, patch);
        return ResponseEntity.ok(mapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        Environment found = getUseCase.getById(id);
        CallerSchoolContext.requireSchool(found.getSchoolId());
        deleteUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }
}
