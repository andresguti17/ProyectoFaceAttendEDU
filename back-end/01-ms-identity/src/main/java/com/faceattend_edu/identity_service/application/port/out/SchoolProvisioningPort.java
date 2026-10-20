package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.application.port.in.OnboardSchoolUseCase;

import java.util.UUID;

/**
 * Calls other bounded contexts (academic, authorization) on behalf of the
 * onboarding flow. Every call carries an internal session token because those
 * services authorize each request with a session + RBAC.
 */
public interface SchoolProvisioningPort {

    boolean schoolCodeExists(String sessionToken, String code);

    /** Creates the school inactive (status=false) and returns its id. */
    long createSchool(String sessionToken, OnboardSchoolUseCase.School school);

    void assignAdminRole(String sessionToken, UUID userId);

    void removeAdminRole(String sessionToken, UUID userId);

    /** Links the admin to the school (academic_actor of type ADMIN) and returns the actor id. */
    long linkAdminToSchool(String sessionToken, UUID personId, long schoolId, String actorCode);

    void deleteActor(String sessionToken, long actorId);

    void deleteSchool(String sessionToken, long schoolId);
}
