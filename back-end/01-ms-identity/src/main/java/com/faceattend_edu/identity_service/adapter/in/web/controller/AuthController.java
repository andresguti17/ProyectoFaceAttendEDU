package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.AuthRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.RefreshSessionRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.TwoFactorCodeRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.TwoFactorPasswordRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.TwoFactorStatusDto;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UserDto;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UserSessionDto;
import com.faceattend_edu.identity_service.adapter.in.web.dto.VerifyLoginCodeRequest;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserSessionWebMapper;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.UserWebMapper;
import com.faceattend_edu.identity_service.application.port.in.AuthenticateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetUserByUsernameUseCase;
import com.faceattend_edu.identity_service.application.port.in.ManageTwoFactorUseCase;
import com.faceattend_edu.identity_service.application.port.in.VerifyLoginCodeUseCase;
import com.faceattend_edu.identity_service.application.port.in.RefreshSessionUseCase;
import com.faceattend_edu.identity_service.domain.exception.EntityNotFoundException;
import com.faceattend_edu.identity_service.domain.exception.TwoFactorRequiredException;
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
    private final VerifyLoginCodeUseCase verifyLoginCodeUseCase;
    private final ManageTwoFactorUseCase manageTwoFactorUseCase;
    private final UserSessionWebMapper sessionWebMapper;
    private final UserWebMapper userWebMapper;

    @PostMapping("/login")
    public ResponseEntity<UserSessionDto> login(@Valid @RequestBody AuthRequest authRequest) {
        try {
            return ResponseEntity.ok(sessionWebMapper.toDto(
                    authenticateUserUseCase.authenticate(authRequest.getIdentifier(), authRequest.getPassword())));
        } catch (TwoFactorRequiredException challenge) {
            // 200 without a session: the client asks for the e-mailed code and calls /login/verify.
            UserSessionDto pending = new UserSessionDto();
            pending.setTwoFactorRequired(true);
            pending.setMaskedEmail(challenge.getMaskedEmail());
            return ResponseEntity.ok(pending);
        }
    }

    /** Second step of a login with two-factor: the e-mailed code opens the session. */
    @PostMapping("/login/verify")
    public ResponseEntity<UserSessionDto> verifyLogin(@Valid @RequestBody VerifyLoginCodeRequest request) {
        return ResponseEntity.ok(sessionWebMapper.toDto(
                verifyLoginCodeUseCase.verify(request.getIdentifier(), request.getCode())));
    }

    /** Starts enabling the second factor: checks the password and e-mails a code. */
    @PostMapping("/two-factor/enable")
    public ResponseEntity<TwoFactorStatusDto> requestEnableTwoFactor(@Valid @RequestBody TwoFactorPasswordRequest request,
                                                                     HttpServletRequest http) {
        String masked = manageTwoFactorUseCase.requestEnable(caller(http), request.getPassword());
        return ResponseEntity.accepted().body(new TwoFactorStatusDto(false, masked));
    }

    /** Finishes enabling with the e-mailed code. */
    @PostMapping("/two-factor/confirm")
    public ResponseEntity<TwoFactorStatusDto> confirmTwoFactor(@Valid @RequestBody TwoFactorCodeRequest request,
                                                               HttpServletRequest http) {
        manageTwoFactorUseCase.confirmEnable(caller(http), request.getCode());
        return ResponseEntity.ok(new TwoFactorStatusDto(true, null));
    }

    @PostMapping("/two-factor/disable")
    public ResponseEntity<TwoFactorStatusDto> disableTwoFactor(@Valid @RequestBody TwoFactorPasswordRequest request,
                                                               HttpServletRequest http) {
        manageTwoFactorUseCase.disable(caller(http), request.getPassword());
        return ResponseEntity.ok(new TwoFactorStatusDto(false, null));
    }

    private static UUID caller(HttpServletRequest http) {
        Object caller = http.getAttribute("X-User-Id");
        if (caller == null) {
            throw new UnauthorizedException("Authentication required");
        }
        return UUID.fromString(String.valueOf(caller));
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
