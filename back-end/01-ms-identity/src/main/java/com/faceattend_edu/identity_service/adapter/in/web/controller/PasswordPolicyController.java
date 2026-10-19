package com.faceattend_edu.identity_service.adapter.in.web.controller;

import com.faceattend_edu.identity_service.adapter.in.web.dto.PageResponse;
import com.faceattend_edu.identity_service.adapter.in.web.dto.PasswordPolicyDto;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.PasswordPolicyWebMapper;
import com.faceattend_edu.identity_service.application.port.in.CreatePasswordPolicyUseCase;
import com.faceattend_edu.identity_service.application.port.in.GetPasswordPolicyUseCase;
import com.faceattend_edu.identity_service.application.port.in.ListPasswordPoliciesUseCase;
import com.faceattend_edu.identity_service.application.port.in.UpdatePasswordPolicyUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/password-policies")
@RequiredArgsConstructor
public class PasswordPolicyController {

    private final CreatePasswordPolicyUseCase createPasswordPolicyUseCase;
    private final GetPasswordPolicyUseCase getPasswordPolicyUseCase;
    private final ListPasswordPoliciesUseCase listPasswordPoliciesUseCase;
    private final UpdatePasswordPolicyUseCase updatePasswordPolicyUseCase;
    private final PasswordPolicyWebMapper passwordPolicyWebMapper;

    @PostMapping
    public ResponseEntity<PasswordPolicyDto> createPolicy(@RequestBody PasswordPolicyDto policyDto) {
        return ResponseEntity.ok(passwordPolicyWebMapper.toDto(
                createPasswordPolicyUseCase.createPolicy(passwordPolicyWebMapper.toDomain(policyDto))));
    }

    @GetMapping
    public ResponseEntity<PageResponse<PasswordPolicyDto>> listPolicies(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer limit) {
        List<PasswordPolicyDto> all = listPasswordPoliciesUseCase.listPolicies().stream()
                .map(passwordPolicyWebMapper::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(PageResponse.of(all, page, limit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PasswordPolicyDto> getPolicy(@PathVariable Integer id) {
        return ResponseEntity.ok(passwordPolicyWebMapper.toDto(getPasswordPolicyUseCase.getPolicy(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updatePolicy(@PathVariable Integer id, @RequestBody PasswordPolicyDto policyDto) {
        policyDto.setPolicyId(id);
        updatePasswordPolicyUseCase.updatePolicy(passwordPolicyWebMapper.toDomain(policyDto));
        return ResponseEntity.noContent().build();
    }
}
