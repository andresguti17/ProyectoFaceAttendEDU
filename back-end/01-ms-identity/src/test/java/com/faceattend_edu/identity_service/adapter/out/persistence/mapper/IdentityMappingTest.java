package com.faceattend_edu.identity_service.adapter.out.persistence.mapper;

import com.faceattend_edu.identity_service.adapter.in.web.dto.PasswordPolicyDto;
import com.faceattend_edu.identity_service.adapter.in.web.mapper.PasswordPolicyWebMapper;
import com.faceattend_edu.identity_service.domain.model.PasswordPolicy;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.model.UserSession;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Identity mappers keep every field, nested aggregates included")
class IdentityMappingTest {

    /** Fills every simple field with a distinct sample value so a dropped column fails the round trip. */
    static <T> T filled(T target) {
        int n = 1;
        for (Class<?> c = target.getClass(); c != Object.class; c = c.getSuperclass()) {
            for (Field f : c.getDeclaredFields()) {
                if (Modifier.isStatic(f.getModifiers()) || Modifier.isFinal(f.getModifiers())) continue;
                Object value = sample(f.getType(), n++);
                if (value == null) continue;
                try {
                    f.setAccessible(true);
                    f.set(target, value);
                } catch (IllegalAccessException e) {
                    throw new IllegalStateException(e);
                }
            }
        }
        return target;
    }

    private static Object sample(Class<?> type, int n) {
        if (type == Long.class || type == long.class) return (long) n;
        if (type == Integer.class || type == int.class) return n;
        if (type == Short.class || type == short.class) return (short) n;
        if (type == Boolean.class || type == boolean.class) return true;
        if (type == String.class) return "value-" + n;
        if (type == BigDecimal.class) return new BigDecimal(n);
        if (type == Instant.class) return Instant.parse("2026-10-01T10:00:00Z").plusSeconds(n);
        if (type == LocalDateTime.class) return LocalDateTime.of(2026, 10, 1, 10, 0).plusMinutes(n);
        if (type == LocalDate.class) return LocalDate.of(2026, 10, n % 28 + 1);
        if (type == UUID.class) return new UUID(0, n);
        if (type.isEnum()) return type.getEnumConstants()[0];
        return null;
    }

    private final PersonPersistenceMapper persons = new PersonPersistenceMapper();
    private final UserPersistenceMapper users = new UserPersistenceMapper(persons);
    private final UserSessionPersistenceMapper sessions = new UserSessionPersistenceMapper(users);

    @Test
    void personRoundTrip() {
        Person person = filled(new Person());
        assertThat(persons.toDomain(persons.toEntity(person))).usingRecursiveComparison().isEqualTo(person);
        assertThat(persons.toDomain(null)).isNull();
        assertThat(persons.toEntity(null)).isNull();
    }

    @Test
    void userRoundTripKeepsItsPerson() {
        User user = filled(new User());
        user.setPersonId(filled(new Person()));
        User back = users.toDomain(users.toEntity(user));
        assertThat(back).usingRecursiveComparison().isEqualTo(user);
        assertThat(back.getPersonId().getPersonId()).isEqualTo(user.getPersonId().getPersonId());
        assertThat(users.toDomain(null)).isNull();
        assertThat(users.toEntity(null)).isNull();
    }

    @Test
    void sessionRoundTripKeepsItsUser() {
        User user = filled(new User());
        user.setPersonId(filled(new Person()));
        UserSession session = filled(new UserSession());
        session.setUserId(user);
        assertThat(sessions.toDomain(sessions.toEntity(session))).usingRecursiveComparison().isEqualTo(session);
        assertThat(sessions.toDomain(null)).isNull();
        assertThat(sessions.toEntity(null)).isNull();
    }

    @Test
    void passwordPolicyRoundTripsThroughPersistenceAndWeb() {
        PasswordPolicy policy = filled(new PasswordPolicy());
        PasswordPolicyPersistenceMapper persistence = new PasswordPolicyPersistenceMapper();
        assertThat(persistence.toDomain(persistence.toEntity(policy))).usingRecursiveComparison().isEqualTo(policy);
        assertThat(persistence.toDomain(null)).isNull();
        assertThat(persistence.toEntity(null)).isNull();

        PasswordPolicyWebMapper web = new PasswordPolicyWebMapper();
        PasswordPolicyDto dto = web.toDto(policy);
        assertThat(dto.getMinLength()).isEqualTo(policy.getMinLength());
        assertThat(web.toDomain(dto).getMaxLength()).isEqualTo(policy.getMaxLength());
        assertThat(web.toDto(null)).isNull();
        assertThat(web.toDomain(null)).isNull();
    }
}
