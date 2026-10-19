package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.*;
import com.faceattend_edu.authorization_service.domain.port.out.RolePermissionRepository;
import com.faceattend_edu.authorization_service.infrastructure.web.dto.*;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.PermissionWebMapper;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.RoleWebMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/v1/roles", "/roles"})
@RequiredArgsConstructor
public class RoleController {

    private final CreateRoleUseCase createRoleUseCase;
    private final UpdateRoleUseCase updateRoleUseCase;
    private final GetRoleUseCase getRoleUseCase;
    private final ListRolesUseCase listRolesUseCase;
    private final DeleteRoleUseCase deleteRoleUseCase;
    private final AssignPermissionToRoleUseCase assignPermissionToRoleUseCase;
    private final RolePermissionRepository rolePermissionRepository;
    private final RoleWebMapper roleWebMapper;
    private final PermissionWebMapper permissionWebMapper;

    @GetMapping
    public ResponseEntity<List<RoleResponse>> listRoles() {
        List<RoleResponse> list = listRolesUseCase.listRoles().stream()
                .map(roleWebMapper::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<RoleResponse> createRole(@Valid @RequestBody CreateRoleRequest req) {
        Role created = createRoleUseCase.createRole(req.getRoleName(), req.getDescription());
        return ResponseEntity.status(HttpStatus.CREATED).body(roleWebMapper.toResponse(created));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoleResponse> getRole(@PathVariable Integer id) {
        Role role = getRoleUseCase.getRole(id);
        return ResponseEntity.ok(roleWebMapper.toResponse(role));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RoleResponse> updateRole(@PathVariable Integer id, @Valid @RequestBody UpdateRoleRequest req) {
        Role updated = updateRoleUseCase.updateRole(id, req.getRoleName(), req.getDescription());
        return ResponseEntity.ok(roleWebMapper.toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRole(@PathVariable Integer id) {
        deleteRoleUseCase.deleteRole(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{roleId}/permissions")
    public ResponseEntity<Void> assignPermission(@PathVariable Integer roleId, @Valid @RequestBody AssignPermissionRequest req) {
        assignPermissionToRoleUseCase.assignPermissionToRole(roleId, req.getPermissionId());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping("/{roleId}/permissions/{permId}")
    public ResponseEntity<Void> removePermission(@PathVariable Integer roleId, @PathVariable Integer permId) {
        assignPermissionToRoleUseCase.removePermissionFromRole(roleId, permId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{roleId}/permissions")
    public ResponseEntity<List<PermissionResponse>> getPermissionsForRole(@PathVariable Integer roleId) {
        // verify role exists
        getRoleUseCase.getRole(roleId);
        List<Permission> perms = rolePermissionRepository.findPermissionsByRoleId(roleId);
        List<PermissionResponse> resp = perms.stream().map(permissionWebMapper::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(resp);
    }
}
