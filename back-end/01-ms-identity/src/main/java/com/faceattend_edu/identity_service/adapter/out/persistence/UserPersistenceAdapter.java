package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.UserJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.UserPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.UserJpaRepository;
import com.faceattend_edu.identity_service.application.port.out.LoadUserPort;
import com.faceattend_edu.identity_service.application.port.out.SaveUserPort;
import com.faceattend_edu.identity_service.application.port.out.UpdateUserPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByIdentifierPort;
import com.faceattend_edu.identity_service.application.port.out.LoadUserByUsernamePort;
import com.faceattend_edu.identity_service.application.port.out.ListUsersPort;
import com.faceattend_edu.identity_service.application.port.out.RemoveIdentityPort;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.PersonJpaRepository;
import org.springframework.transaction.annotation.Transactional;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class UserPersistenceAdapter implements LoadUserPort, SaveUserPort, UpdateUserPort, LoadUserByUsernamePort,
        LoadUserByIdentifierPort, ListUsersPort, RemoveIdentityPort {

    private final UserJpaRepository repository;
    private final PersonJpaRepository personRepository;
    private final UserPersistenceMapper mapper;

    /** Compensation of a failed provisioning: the rows were created moments ago and never used. */
    @Override
    @Transactional
    public void removeUserAndPerson(UUID userId, UUID personId) {
        if (userId != null) repository.deleteById(userId);
        if (personId != null) personRepository.deleteById(personId);
    }

    @Override
    public User loadUser(UUID userId) {
        return mapper.toDomain(repository.findById(userId).orElse(null));
    }

    @Override
    public User loadUserByUsername(String username) {
        return mapper.toDomain(repository.findByUsername(username).orElse(null));
    }

    /**
     * Identifier resolution lives here (not in a use case) so both login and /me share one
     * definition: '@' means email, anything else means username.
     */
    @Override
    public User loadUserByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) return null;

        String value = identifier.trim();
        if (!value.contains("@")) {
            return mapper.toDomain(repository.findByUsername(value).orElse(null));
        }

        // Ambiguous emails resolve to null: the 401 must not reveal whether the address exists.
        List<UserJpaEntity> matches = repository.findByPersonEmail(
                com.faceattend_edu.identity_service.adapter.out.persistence.crypto.PiiCipher.current()
                        .hash(com.faceattend_edu.identity_service.adapter.out.persistence.entity.PersonJpaEntity.normalizeEmail(value)),
                value);
        return matches.size() == 1 ? mapper.toDomain(matches.get(0)) : null;
    }

    // Sorted by the primary key: without a deterministic order Postgres may repeat or skip
    // rows between pages, so a client walking every page would not see the table exactly once.
    // Soft-deleted users are excluded (findAllActive) per the model's soft-delete rule.
    @Override
    public List<User> listUsers(int pageIndex, int limit) {
        return repository.findAllActive(PageRequest.of(pageIndex, limit, Sort.by("userId")))
                .map(mapper::toDomain)
                .getContent();
    }

    @Override
    public long countUsers() {
        return repository.countActive();
    }

    @Override
    public List<User> listUsers(int pageIndex, int limit, Set<UUID> personIds) {
        return repository.findAllActiveInPersons(personIds, PageRequest.of(pageIndex, limit, Sort.by("userId")))
                .map(mapper::toDomain)
                .getContent();
    }

    @Override
    public long countUsers(Set<UUID> personIds) {
        return repository.countActiveInPersons(personIds);
    }

    @Override
    public User saveUser(User user) {
        return mapper.toDomain(repository.save(mapper.toEntity(user)));
    }

    @Override
    public void updateUser(User user) {
        repository.save(mapper.toEntity(user));
    }
}
