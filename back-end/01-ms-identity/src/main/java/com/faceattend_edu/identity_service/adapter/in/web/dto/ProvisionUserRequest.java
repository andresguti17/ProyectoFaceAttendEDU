package com.faceattend_edu.identity_service.adapter.in.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Composite registration of an account: person, user, academic actor (+ enrollment) and role. */
@Data
public class ProvisionUserRequest {

    @Valid
    @NotNull
    private PersonDto person;

    @NotBlank
    @Size(max = 255)
    private String username;

    @NotBlank
    @Size(min = 8, max = 128)
    private String password;

    private Boolean sendCredentials;

    /** Administrador, Instructor or Aprendiz. */
    @NotBlank
    private String roleName;

    /** Optional: the account's academic actor in a school (and enrollment for apprentices). */
    @Valid
    private AcademicActor academicActor;

    @Data
    public static class AcademicActor {
        /** 1 = apprentice, 2 = instructor, 3 = school administrator. */
        @NotNull
        private Integer actorTypeId;

        @NotNull
        private Long schoolId;

        @NotBlank
        @Size(max = 50)
        private String actorCode;

        /** Apprentices only: the cohort they are enrolled in. */
        private Long cohortId;
    }
}
