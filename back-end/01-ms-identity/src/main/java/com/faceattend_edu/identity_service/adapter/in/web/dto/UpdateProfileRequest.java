package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/**
 * Body of PUT /api/v1/auth/me/profile. Only the fields a person may edit about
 * themselves: names, document, status, username and role are not here on purpose.
 */
@Data
public class UpdateProfileRequest {

    @Size(max = 50)
    private String phone;

    @Size(max = 255)
    private String address;

    private LocalDate birthDate;

    @Size(max = 5)
    @Pattern(regexp = "^$|A\\+|A-|B\\+|B-|AB\\+|AB-|O\\+|O-", message = "must be one of A+, A-, B+, B-, AB+, AB-, O+, O-")
    private String bloodType;

    /** A new address needs {@code currentPassword}: it is the login identifier. */
    @Email
    @Size(max = 255)
    private String email;

    private String currentPassword;
}
