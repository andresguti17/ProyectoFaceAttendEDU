package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.mapper.PersonPersistenceMapper;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.PersonJpaRepository;
import com.faceattend_edu.identity_service.application.port.out.LoadPersonPort;
import com.faceattend_edu.identity_service.application.port.out.ListPersonsPort;
import com.faceattend_edu.identity_service.application.port.out.SavePersonPort;
import com.faceattend_edu.identity_service.application.port.out.UpdatePersonPort;
import com.faceattend_edu.identity_service.domain.model.Person;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class PersonPersistenceAdapter implements LoadPersonPort, SavePersonPort, UpdatePersonPort, ListPersonsPort {

    private final PersonJpaRepository repository;
    private final PersonPersistenceMapper mapper;

    @Override
    public Person loadPerson(UUID personId) {
        return mapper.toDomain(repository.findById(personId).orElse(null));
    }

    // Sorted by the primary key: without a deterministic order Postgres may repeat or skip
    // rows between pages, so a client walking every page would not see the table exactly once.
    // Soft-deleted persons are excluded (findAllActive) per the model's soft-delete rule.
    @Override
    public List<Person> listPersons(int pageIndex, int limit) {
        return repository.findAllActive(PageRequest.of(pageIndex, limit, Sort.by("personId")))
                .map(mapper::toDomain)
                .getContent();
    }

    @Override
    public long countPersons() {
        return repository.countActive();
    }

    @Override
    public Person savePerson(Person person) {
        return mapper.toDomain(repository.save(mapper.toEntity(person)));
    }

    @Override
    public void updatePerson(Person person) {
        repository.save(mapper.toEntity(person));
    }
}
