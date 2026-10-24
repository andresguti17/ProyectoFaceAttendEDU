package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.CreatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.NotifyUserCredentialsUseCase;
import com.faceattend_edu.identity_service.application.port.in.ProvisionUserUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByUsernamePort;
import com.faceattend_edu.identity_service.application.port.out.RemoveIdentityPort;
import com.faceattend_edu.identity_service.application.port.out.UserProvisioningPort;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.ValidationException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RequiredArgsConstructor
@Service
public class ProvisionUserUseCaseImpl implements ProvisionUserUseCase {

    /** Role name -> academic actor type it requires. "Super Administrador" is never granted here. */
    static final Map<String, Integer> ROLE_ACTOR_TYPE = Map.of(
            "Aprendiz", 1,
            "Instructor", 2,
            "Administrador", 3);

    private final CreatePersonUseCase createPersonUseCase;
    private final CreateUserUseCase createUserUseCase;
    private final NotifyUserCredentialsUseCase notifyUserCredentialsUseCase;
    private final LoadUserByUsernamePort loadUserByUsernamePort;
    private final UserProvisioningPort provisioning;
    private final RemoveIdentityPort removeIdentityPort;

    @Override
    public Result provision(Command command, String token) {
        validate(command);
        if (loadUserByUsernamePort.loadUserByUsername(command.username()) != null) {
            throw new DuplicateEntityException("User", command.username());
        }

        Person person = createPersonUseCase.createPerson(command.person());
        UUID personId = person.getPersonId();
        UUID userId = null;
        Long actorId = null;
        Long enrollmentId = null;
        boolean roleRequested = false;
        try {
            User user = new User();
            user.setPersonId(person);
            user.setUsername(command.username());
            User created = createUserUseCase.createUser(user, command.password());
            userId = created.getUserId();

            Actor actor = command.actor();
            if (actor != null) {
                actorId = provisioning.createActor(token, personId, actor.actorTypeId(), actor.schoolId(), actor.actorCode());
                if (actor.cohortId() != null) {
                    enrollmentId = provisioning.createEnrollment(token, actorId, actor.cohortId());
                }
            }
            roleRequested = true;
            provisioning.assignRole(token, userId, command.roleName());

            String credentials = null;
            if (command.sendCredentials()) {
                credentials = notifyUserCredentialsUseCase.notifyCredentials(userId, command.password()).name();
            }
            return new Result(personId, userId, created.getUsername(), actorId, enrollmentId, credentials);
        } catch (RuntimeException ex) {
            log.warn("Provisioning of {} failed, undoing the steps already done: {}", command.username(), ex.getMessage());
            undo(token, command.roleName(), personId, userId, actorId, enrollmentId, roleRequested, command.actor() != null);
            throw ex;
        }
    }

    /**
     * Every step is independent and best-effort, and a call that failed may still have gone
     * through (a timeout is not a "no"): the role is removed whenever it was requested and
     * actors are looked up by person when their id never came back.
     */
    private void undo(String token, String roleName, UUID personId, UUID userId, Long actorId,
                      Long enrollmentId, boolean roleRequested, boolean actorRequested) {
        if (roleRequested && userId != null) {
            run("remove role", () -> provisioning.removeRole(token, userId, roleName));
        }
        if (enrollmentId != null) {
            run("delete enrollment", () -> provisioning.deleteEnrollment(token, enrollmentId));
        }
        if (actorRequested) run("delete actor", () -> {
            List<Long> actors = actorId != null ? List.of(actorId) : provisioning.findActorIdsByPerson(token, personId);
            for (Long id : actors) provisioning.deleteActor(token, id);
        });
        run("delete identity rows", () -> removeIdentityPort.removeUserAndPerson(userId, personId));
    }

    private void run(String step, Runnable action) {
        try {
            action.run();
        } catch (RuntimeException ex) {
            log.error("Provisioning rollback step '{}' failed: {}", step, ex.getMessage());
        }
    }

    private static void validate(Command command) {
        if (command.person() == null) throw new ValidationException("person is required");
        if (isBlank(command.username())) throw new ValidationException("username is required");
        if (isBlank(command.password())) throw new ValidationException("password is required");
        Integer actorType = ROLE_ACTOR_TYPE.get(command.roleName());
        if (actorType == null) {
            throw new ValidationException("roleName must be one of " + ROLE_ACTOR_TYPE.keySet());
        }
        // The academic actor is optional (an account may not belong to a school yet), but when
        // it comes it must match the role; the enrollment only exists for apprentices.
        Actor actor = command.actor();
        if (actor == null) return;
        if (actor.actorTypeId() != actorType) {
            throw new ValidationException("academicActor.actorTypeId must be " + actorType + " for " + command.roleName());
        }
        if (isBlank(actor.actorCode())) throw new ValidationException("academicActor.actorCode is required");
        if (actorType != 1 && actor.cohortId() != null) {
            throw new ValidationException("cohortId only applies to apprentices");
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
