package com.faceattend_edu.identity_service.application.port.out;

import java.util.List;
import java.util.UUID;

/**
 * Calls academic (actors, enrollments) and authorization (roles) for the account
 * provisioning flow, with the caller's own session token.
 */
public interface UserProvisioningPort {

    long createActor(String sessionToken, UUID personId, int actorTypeId, long schoolId, String actorCode);

    List<Long> findActorIdsByPerson(String sessionToken, UUID personId);

    void deleteActor(String sessionToken, long actorId);

    long createEnrollment(String sessionToken, long actorId, long cohortId);

    void deleteEnrollment(String sessionToken, long enrollmentId);

    void assignRole(String sessionToken, UUID userId, String roleName);

    void removeRole(String sessionToken, UUID userId, String roleName);
}
