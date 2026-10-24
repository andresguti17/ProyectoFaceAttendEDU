package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Person;

import java.util.UUID;

/**
 * Registers a complete account in one call: person + user (identity), academic actor and
 * enrollment (academic) and role (authorization). If any step fails, the steps already done
 * are undone on the server, so no orphan rows are left in any context.
 */
public interface ProvisionUserUseCase {

    /** Academic actor of the new account; {@code cohortId} only for apprentices (enrollment). */
    record Actor(int actorTypeId, long schoolId, String actorCode, Long cohortId) {}

    record Command(Person person, String username, String password, boolean sendCredentials,
                   String roleName, Actor actor) {}

    record Result(UUID personId, UUID userId, String username, Long academicActorId, Long enrollmentId,
                  String credentialsEmail) {}

    /** @param callerToken the caller's session: the other services apply their own RBAC and scope to it */
    Result provision(Command command, String callerToken);
}
