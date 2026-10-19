package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.PageResponse;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UserSessionDto;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserSessionWebMapper;
import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserSessionsUseCase;
import com.faceattend_edu.identity_service.application.port.in.ListUserSessionsUseCase;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
@Validated
public class SessionController {

    private final CreateUserSessionUseCase createUserSessionUseCase;
    private final CloseUserSessionUseCase closeUserSessionUseCase;
    private final GetUserSessionUseCase getUserSessionUseCase;
    private final GetUserSessionsUseCase getUserSessionsUseCase;
    private final ListUserSessionsUseCase listUserSessionsUseCase;
    private final UserSessionWebMapper sessionWebMapper;

    @PostMapping
    public ResponseEntity<UserSessionDto> createSession(
            @RequestParam @NotNull UUID userId,
            @RequestParam(required = false) String sourceIp) {
        return ResponseEntity.ok(sessionWebMapper.toDto(createUserSessionUseCase.createSession(userId, sourceIp)));
    }

    @GetMapping
    public ResponseEntity<PageResponse<UserSessionDto>> listSessions(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer limit) {
        List<UserSessionDto> all = listUserSessionsUseCase.listUserSessions().stream()
                .map(sessionWebMapper::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(PageResponse.of(all, page, limit));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> closeSession(@PathVariable UUID id) {
        closeUserSessionUseCase.closeSession(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserSessionDto> getSession(@PathVariable UUID id) {
        return ResponseEntity.ok(sessionWebMapper.toDto(getUserSessionUseCase.getUserSession(id)));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<UserSessionDto>> getUserSessions(@PathVariable UUID userId) {
        return ResponseEntity.ok(getUserSessionsUseCase.getUserSessions(userId).stream()
                .map(sessionWebMapper::toDto)
                .collect(Collectors.toList()));
    }
}
