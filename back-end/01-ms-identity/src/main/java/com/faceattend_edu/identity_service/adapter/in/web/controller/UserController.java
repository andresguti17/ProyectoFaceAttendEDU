package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.CreateUserRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.PageResponse;
import com.faceattend_edu.identity_service.adapter.in.web.dto.ProvisionUserRequest;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.PersonWebMapper;
import com.faceattend_edu.identity_service.application.port.in.ProvisionUserUseCase;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UserDto;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserWebMapper;
import com.faceattend_edu.identity_service.adapter.in.web.security.AuthTokenFilter;
import com.faceattend_edu.identity_service.application.port.in.ActivateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.ChangeUserStatusUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.ListUsersUseCase;
import com.faceattend_edu.identity_service.application.port.in.NotifyUserCredentialsUseCase;
import com.faceattend_edu.identity_service.application.port.in.UpdateUserUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final CreateUserUseCase createUserUseCase;
    private final GetUserUseCase getUserUseCase;
    private final ListUsersUseCase listUsersUseCase;
    private final UpdateUserUseCase updateUserUseCase;
    private final ChangeUserStatusUseCase changeUserStatusUseCase;
    private final ActivateUserUseCase activateUserUseCase;
    private final NotifyUserCredentialsUseCase notifyUserCredentialsUseCase;
    private final UserWebMapper userWebMapper;
    private final ProvisionUserUseCase provisionUserUseCase;
    private final PersonWebMapper personWebMapper;

    @PostMapping
    public ResponseEntity<UserDto> createUser(@Valid @RequestBody CreateUserRequest request) {
        var created = createUserUseCase.createUser(userWebMapper.toDomain(request), request.getPassword());
        UserDto body = userWebMapper.toDto(created);
        if (Boolean.TRUE.equals(request.getSendCredentials())) {
            var status = notifyUserCredentialsUseCase.notifyCredentials(created.getUserId(), request.getPassword());
            body.setCredentialsEmail(status.name());
            body.setMustChangePassword(status == NotifyUserCredentialsUseCase.Status.SENT);
        }
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(created.getUserId()).toUri();
        return ResponseEntity.created(location).body(body);
    }

    /**
     * Registers person + user + academic actor (+ enrollment) + role in one call. Any failed
     * step is undone on the server (no orphan rows); the other services apply their own RBAC
     * and school scope to the caller's session.
     */
    @PostMapping("/provision")
    public ResponseEntity<ProvisionUserUseCase.Result> provision(@Valid @RequestBody ProvisionUserRequest request,
                                                                 HttpServletRequest http) {
        String header = http.getHeader("Authorization");
        if (header == null || !header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            throw new UnauthorizedException("Authentication required");
        }
        ProvisionUserRequest.AcademicActor actor = request.getAcademicActor();
        ProvisionUserUseCase.Command command = new ProvisionUserUseCase.Command(
                personWebMapper.toDomain(request.getPerson()),
                request.getUsername().trim(),
                request.getPassword(),
                Boolean.TRUE.equals(request.getSendCredentials()),
                request.getRoleName().trim(),
                actor == null ? null
                        : new ProvisionUserUseCase.Actor(actor.getActorTypeId(), actor.getSchoolId(), actor.getActorCode(), actor.getCohortId()));
        ProvisionUserUseCase.Result result = provisionUserUseCase.provision(command, header.substring(7).trim());
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/users/{id}").buildAndExpand(result.userId()).toUri();
        return ResponseEntity.created(location).body(result);
    }

    @GetMapping
    public ResponseEntity<PageResponse<UserDto>> listUsers(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer limit,
            HttpServletRequest request) {
        int safePage = PageResponse.safePage(page);
        int safeLimit = PageResponse.safeLimit(limit);
        if (request.getAttribute(AuthTokenFilter.PERSON_SCOPE_ATTRIBUTE) instanceof Set<?> scope) {
            // Administrador de sede: solo cuentas de personas de su propia sede. El
            // filtro ya resolvió el alcance; aquí se pagina en SQL sobre ese subconjunto.
            Set<UUID> personIds = scope.stream().map(id -> (UUID) id).collect(Collectors.toSet());
            if (personIds.isEmpty()) {
                return ResponseEntity.ok(PageResponse.ofSlice(List.of(), safePage, safeLimit, 0));
            }
            List<UserDto> scoped = listUsersUseCase.listUsers(safePage - 1, safeLimit, personIds).stream()
                    .map(userWebMapper::toDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(
                    PageResponse.ofSlice(scoped, safePage, safeLimit, listUsersUseCase.countUsers(personIds)));
        }
        List<UserDto> slice = listUsersUseCase.listUsers(safePage - 1, safeLimit).stream()
                .map(userWebMapper::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(
                PageResponse.ofSlice(slice, safePage, safeLimit, listUsersUseCase.countUsers()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDto> getUser(@PathVariable UUID id) {
        return ResponseEntity.ok(userWebMapper.toDto(getUserUseCase.getUser(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateUser(@PathVariable UUID id, @RequestBody UserDto userDto) {
        userDto.setUserId(id);
        updateUserUseCase.updateUser(userWebMapper.toDomain(userDto));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<Void> activateUser(@PathVariable UUID id) {
        activateUserUseCase.activateUser(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable UUID id, @RequestParam boolean status) {
        changeUserStatusUseCase.changeStatus(id, status);
        return ResponseEntity.noContent().build();
    }
}
