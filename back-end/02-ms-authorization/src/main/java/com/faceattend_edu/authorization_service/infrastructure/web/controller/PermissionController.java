package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.port.in.*;
import com.faceattend_edu.authorization_service.infrastructure.web.dto.*;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.PermissionWebMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/permissions", "/permissions"})
@RequiredArgsConstructor
public class PermissionController {

    private final CreatePermissionUseCase createPermissionUseCase;
    private final UpdatePermissionUseCase updatePermissionUseCase;
    private final GetPermissionUseCase getPermissionUseCase;
    private final ListPermissionsUseCase listPermissionsUseCase;
    private final DeletePermissionUseCase deletePermissionUseCase;
    private final PermissionWebMapper mapper;

    @GetMapping
    public ResponseEntity<List<PermissionResponse>> listPermissions() {
        List<PermissionResponse> list = listPermissionsUseCase.listPermissions().stream()
                .map(mapper::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<PermissionResponse> createPermission(@Valid @RequestBody CreatePermissionRequest req) {
        Permission p = createPermissionUseCase.createPermission(req.getPermissionName(), req.getDescription());
        return ResponseEntity.status(HttpStatus.CREATED).body(mapper.toResponse(p));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PermissionResponse> getPermission(@PathVariable Integer id) {
        Permission p = getPermissionUseCase.getPermission(id);
        return ResponseEntity.ok(mapper.toResponse(p));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PermissionResponse> updatePermission(@PathVariable Integer id, @Valid @RequestBody UpdatePermissionRequest req) {
        Permission updated = updatePermissionUseCase.updatePermission(id, req.getPermissionName(), req.getDescription());
        return ResponseEntity.ok(mapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePermission(@PathVariable Integer id) {
        deletePermissionUseCase.deletePermission(id);
        return ResponseEntity.noContent().build();
    }
}
