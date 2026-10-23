package com.faceattend_edu.identity_service.adapter.in.web.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TwoFactorStatusDto {

    private boolean twoFactorEnabled;

    /** Where the code was sent, with the middle masked; null when no code was sent. */
    private String maskedEmail;
}
