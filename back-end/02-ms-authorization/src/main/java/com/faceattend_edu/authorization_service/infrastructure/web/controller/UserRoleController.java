package com.faceattend_edu.authorization_service.infrastructure.web.controller;

import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.AssignRoleToUserUseCase;
import com.faceattend_edu.authorization_service.domain.port.in.CheckPermissionUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import com.faceattend_edu.authorization_service.domain.port.out.UserRoleRepository;
import com.faceattend_edu.shared.auth.UserSchools;
import jakarta.servlet.http.HttpServletRequest;
import com.faceattend_edu.authorization_service.infrastructure.web.dto.AssignRoleRequest;
import com.faceattend_edu.authorization_service.infrastructure.web.dto.RoleResponse;
import com.faceattend_edu.authorization_service.infrastructure.web.mapper.RoleWebMapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class UserRoleController {

    /** Keeps the query string inside every sane URL limit and bounds the IN clause. */
    private static final int MAX_BATCH_USERS = 300;

    private static final String SUPER_ADMIN_ROLE = "Super Administrador";
    private static final Set<String> PRIVILEGED_ROLE_NAMES = Set.of(SUPER_ADMIN_ROLE, "Administrador");

    private final AssignRoleToUserUseCase assignRoleToUserUseCase;
    private final CheckPermissionUseCase checkPermissionUseCase;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final RoleWebMapper roleWebMapper;
    private final UserSchools userSchools;

    @PostMapping({"/api/v1/users/{userId}/roles", "/users/{userId}/roles"})
    public ResponseEntity<Void> assignRole(@PathVariable UUID userId, @Valid @RequestBody AssignRoleRequest req,
                                           HttpServletRequest request) {
        if (!mayChangeRole(userId, req.getRoleId(), request)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        assignRoleToUserUseCase.assignRoleToUser(userId, req.getRoleId());
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @DeleteMapping({"/api/v1/users/{userId}/roles/{roleId}", "/users/{userId}/roles/{roleId}"})
    public ResponseEntity<Void> removeRole(@PathVariable UUID userId, @PathVariable Integer roleId,
                                           HttpServletRequest request) {
        if (!mayChangeRole(userId, roleId, request)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        assignRoleToUserUseCase.removeRoleFromUser(userId, roleId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Administrador de sede asigna roles operativos (Aprendiz, Instructor) solo a usuarios
     * de su propia sede; los roles que dan acceso global o de sede, y cualquier usuario
     * de otra sede, quedan para Super Administrador. La sede sale de los academic_actor
     * de cada usuario, consultados con el token del llamante (nunca del cuerpo).
     */
    private boolean mayChangeRole(UUID target, Integer roleId, HttpServletRequest request) {
        List<?> callerRoles = request.getAttribute("X-User-Roles") instanceof List<?> roles ? roles : List.of();
        if (callerRoles.contains(SUPER_ADMIN_ROLE)) return true;
        boolean privileged = roleRepository.findById(roleId)
                .map(role -> PRIVILEGED_ROLE_NAMES.contains(role.getRoleName()))
                .orElse(false);
        if (privileged) return false;

        Object caller = request.getAttribute("X-User-Id");
        String header = request.getHeader("Authorization");
        if (caller == null || header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) return false;
        String token = header.substring(7).trim();
        Set<Integer> callerSchools = userSchools.of(String.valueOf(caller), token);
        return !callerSchools.isEmpty() && !Collections.disjoint(callerSchools, userSchools.of(target.toString(), token));
    }

    @GetMapping({"/api/v1/users/{userId}/roles", "/users/{userId}/roles"})
    public ResponseEntity<List<RoleResponse>> getRolesForUser(@PathVariable UUID userId) {
        List<Role> roles = userRoleRepository.findRolesByUserId(userId);
        List<RoleResponse> resp = roles.stream().map(roleWebMapper::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(resp);
    }

    /**
     * Batch variant of the endpoint above. The users screen needs the roles of every listed
     * user, and asking one by one meant one request per user; here one request covers them all.
     * Users without an assignment are simply absent from the map.
     */
    @GetMapping({"/api/v1/user-roles", "/user-roles"})
    public ResponseEntity<Map<String, List<RoleResponse>>> getRolesForUsers(
            @RequestParam(name = "userIds", required = false) List<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) return ResponseEntity.ok(Map.of());
        if (userIds.size() > MAX_BATCH_USERS) {
            throw new IllegalArgumentException("userIds accepts at most " + MAX_BATCH_USERS + " ids per request");
        }
        Map<String, List<RoleResponse>> body = userRoleRepository.findRolesByUserIds(userIds)
                .entrySet().stream()
                .collect(Collectors.toMap(
                        entry -> entry.getKey().toString(),
                        entry -> entry.getValue().stream().map(roleWebMapper::toResponse).collect(Collectors.toList())));
        return ResponseEntity.ok(body);
    }

    @GetMapping({"/api/v1/auth/evaluate", "/auth/evaluate"})
    public ResponseEntity<Map<String,Object>> evaluate(@RequestParam UUID userId, @RequestParam String permission) {
        boolean has = checkPermissionUseCase.hasPermission(userId, permission);
        return ResponseEntity.ok(Map.of("userId", userId.toString(), "permission", permission, "allowed", has));
    }
}
