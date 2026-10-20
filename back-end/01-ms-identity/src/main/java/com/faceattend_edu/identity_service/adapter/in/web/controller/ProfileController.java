package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.PersonDto;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UpdateProfileRequest;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.PersonWebMapper;
import com.faceattend_edu.identity_service.application.port.in.UpdateOwnProfileUseCase;
import com.faceattend_edu.identity_service.domain.exception.UnauthorizedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Self-service profile: the account comes from the session, never from the body or the path. */
@RestController
@RequestMapping("/api/v1/auth/me")
@RequiredArgsConstructor
public class ProfileController {

    private final UpdateOwnProfileUseCase updateOwnProfileUseCase;
    private final PersonWebMapper personWebMapper;

    @PutMapping("/profile")
    public ResponseEntity<PersonDto> updateProfile(@Valid @RequestBody UpdateProfileRequest request,
                                                   HttpServletRequest http) {
        Object caller = http.getAttribute("X-User-Id");
        if (caller == null) {
            throw new UnauthorizedException("Authentication required");
        }
        var person = updateOwnProfileUseCase.updateProfile(
                UUID.fromString(String.valueOf(caller)),
                new UpdateOwnProfileUseCase.ProfileChanges(
                        request.getPhone(), request.getAddress(), request.getBirthDate(),
                        request.getBloodType(), request.getEmail(), request.getCurrentPassword()));
        return ResponseEntity.ok(personWebMapper.toDto(person));
    }
}
