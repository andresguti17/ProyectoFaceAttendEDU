package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ChangeUserStatusUseCase;
import com.faceattend_edu.identity_service.application.port.in.CloseUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreatePersonUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserSessionUseCase;
import com.faceattend_edu.identity_service.application.port.in.CreateUserUseCase;
import com.faceattend_edu.identity_service.application.port.in.OnboardSchoolUseCase;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByUsernamePort;
import com.faceattend_edu.identity_service.application.port.out.SchoolProvisioningPort;
import com.faceattend_edu.identity_service.config.OnboardingProperties;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.OnboardingUnavailableException;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Registers a school and its first administrator in one call.
 *
 * <p>Order: cheap duplicate checks first, then the identity rows, then the
 * remote resources (school, role, link). Cross-context calls have no shared
 * transaction, so a failure after the school exists removes whatever remote
 * resources were already created; the identity rows stay, inactive.</p>
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class OnboardSchoolUseCaseImpl implements OnboardSchoolUseCase {

    static final String SOURCE = "onboarding";
    static final String ADMIN_ACTOR_PREFIX = "ADM-";

    private final OnboardingProperties properties;
    private final CreateUserSessionUseCase createUserSessionUseCase;
    private final CloseUserSessionUseCase closeUserSessionUseCase;
    private final CreatePersonUseCase createPersonUseCase;
    private final CreateUserUseCase createUserUseCase;
    private final ChangeUserStatusUseCase changeUserStatusUseCase;
    private final LoadUserByUsernamePort loadUserByUsernamePort;
    private final SchoolProvisioningPort provisioning;

    @Override
    public Result onboard(School school, Admin admin) {
        if (!properties.enabled()) {
            throw new OnboardingUnavailableException("School registration is not enabled");
        }
        if (loadUserByUsernamePort.loadUserByUsername(admin.username()) != null) {
            throw new DuplicateEntityException("User", admin.username());
        }

        UserSession session = openServiceSession();
        String token = session.getSessionId().toString();
        try {
            if (provisioning.schoolCodeExists(token, school.code())) {
                throw new DuplicateEntityException("School", school.code());
            }
            return register(token, school, admin);
        } finally {
            closeQuietly(session);
        }
    }

    private Result register(String token, School school, Admin admin) {
        Person person = createPersonUseCase.createPerson(toPerson(admin));
        User user = new User();
        user.setPersonId(person);
        user.setUsername(admin.username());
        User created = createUserUseCase.createUser(user, admin.password());
        // Pending activation: the account cannot log in until a Super Administrador activates it.
        changeUserStatusUseCase.changeStatus(created.getUserId(), false);

        Long schoolId = null;
        Long actorId = null;
        try {
            schoolId = provisioning.createSchool(token, school);
            provisioning.assignAdminRole(token, created.getUserId());
            actorId = provisioning.linkAdminToSchool(
                    token, person.getPersonId(), schoolId, ADMIN_ACTOR_PREFIX + school.code());
            return new Result(schoolId, person.getPersonId(), created.getUserId());
        } catch (RuntimeException ex) {
            log.warn("School onboarding failed for school={} admin={}: {}",
                    school.code(), admin.username(), ex.getMessage());
            rollback(token, created.getUserId(), person.getPersonId(), school.code(), schoolId, actorId);
            if (ex instanceof OnboardingUnavailableException || ex instanceof DuplicateEntityException) throw ex;
            throw new OnboardingUnavailableException("School registration could not be completed", ex);
        }
    }

    /**
     * Undoes the remote resources. A step that threw may still have gone through (a timeout
     * does not mean the other service did nothing), so nothing is skipped just because its own
     * call failed: the role is always removed, and a school or actor whose id we never got is
     * looked up (the person and the code are ours, created moments ago). Each step is
     * independent and a missing resource counts as done.
     */
    private void rollback(String token, UUID userId, UUID personId, String schoolCode, Long schoolId, Long actorId) {
        run(() -> {
            List<Long> actors = actorId != null ? List.of(actorId) : provisioning.findActorIdsByPerson(token, personId);
            for (Long id : actors) provisioning.deleteActor(token, id);
        });
        run(() -> provisioning.removeAdminRole(token, userId));
        run(() -> {
            Long id = schoolId != null ? schoolId : provisioning.findSchoolIdByCode(token, schoolCode);
            if (id != null) provisioning.deleteSchool(token, id);
        });
    }

    private void run(Runnable step) {
        try {
            step.run();
        } catch (RuntimeException ex) {
            log.warn("Onboarding rollback step failed: {}", ex.getMessage());
        }
    }

    private UserSession openServiceSession() {
        try {
            return createUserSessionUseCase.createSession(UUID.fromString(properties.getServiceUserId().trim()), SOURCE);
        } catch (RuntimeException ex) {
            throw new OnboardingUnavailableException("School registration is not available", ex);
        }
    }

    private void closeQuietly(UserSession session) {
        run(() -> closeUserSessionUseCase.closeSession(session.getSessionId()));
    }

    private static Person toPerson(Admin admin) {
        Person person = new Person();
        person.setDocumentType(admin.documentType());
        person.setDocumentNumber(admin.documentNumber());
        person.setName(admin.name());
        person.setLastName(admin.lastName());
        person.setEmail(admin.email());
        person.setPhone(admin.phone());
        return person;
    }
}
