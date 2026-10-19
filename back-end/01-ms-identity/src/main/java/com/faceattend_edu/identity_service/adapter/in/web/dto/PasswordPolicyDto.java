package com.faceattend_edu.identity_service.adapter.in.web.dto;

import lombok.Data;

@Data
public class PasswordPolicyDto {
    private Integer policyId;
    private Integer minLength;
    private Integer maxLength;
    private Boolean requiresUppercase;
    private Boolean requiresNumbers;
    private Boolean requiresSymbols;
    private Integer expirationDays;
}
