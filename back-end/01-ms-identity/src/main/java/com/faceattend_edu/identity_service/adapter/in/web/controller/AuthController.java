package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.AuthRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.RefreshSessionRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UserDto;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UserSessionDto;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserSessionWebMapper;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserWebMapper;
import com.faceattend_edu.identity_service.application.port.in.AuthenticateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserByUsernameUseCase;
import com.faceattend_edu.identity_service.application.port.in.RefreshSessionUseCase;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticateUserUseCase authenticateUserUseCase;
    private final CloseUserSessionUseCase closeUserSessionUseCase;
    private final GetUserByUsernameUseCase getUserByUsernameUseCase;
    private final RefreshSessionUseCase refreshSessionUseCase;
    private final UserSessionWebMapper sessionWebMapper;
    private final UserWebMapper userWebMapper;

    @PostMapping("/login")
    public ResponseEntity<UserSessionDto> login(@Valid @RequestBody AuthRequest authRequest) {
        return ResponseEntity.ok(sessionWebMapper.toDto(
                authenticateUserUseCase.authenticate(authRequest.getIdentifier(), authRequest.getPassword())));
    }

    /**
     * Rotación de la sesión opaca (refresh token): devuelve un sessionId nuevo
     * y el anterior queda cerrado. Falla con 401 si la sesión venció o ya fue
     * renovada (un solo uso).
     */
    @PostMapping("/refresh")
    public ResponseEntity<UserSessionDto> refresh(@Valid @RequestBody RefreshSessionRequest request,
                                                  HttpServletRequest httpRequest) {
        return ResponseEntity.ok(sessionWebMapper.toDto(
                refreshSessionUseCase.refresh(request.getSessionId(), clientIp(httpRequest))));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestParam UUID sessionId) {
        closeUserSessionUseCase.closeSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Perfil de la propia cuenta. Exige sesión (el filtro ya no lo deja público) y solo
     * resuelve la cuenta de quien llama: un identificador ajeno responde 404 para no
     * revelar si existe.
     */
    @GetMapping("/me")
    public ResponseEntity<UserDto> me(@RequestParam(required = false) String username,
                                      @RequestParam(required = false) String email,
                                      HttpServletRequest request) {
        Object caller = request.getAttribute("X-User-Id");
        if (caller == null) {
            throw new UnauthorizedException("Authentication required");
        }
        String identifier = username != null && !username.isBlank() ? username : email;
        if (identifier == null || identifier.isBlank()) {
            throw new ValidationException("username or email is required");
        }
        User user = getUserByUsernameUseCase.getUserByUsername(identifier);
        if (user.getUserId() == null || !user.getUserId().toString().equalsIgnoreCase(String.valueOf(caller))) {
            throw new EntityNotFoundException("User", identifier);
        }
        return ResponseEntity.ok(userWebMapper.toDto(user));
    }
}
