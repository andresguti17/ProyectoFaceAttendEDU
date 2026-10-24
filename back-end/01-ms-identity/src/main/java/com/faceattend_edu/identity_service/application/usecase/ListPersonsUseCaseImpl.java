package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ListPersonsUseCase;
import com.faceattend_edu.identity_service.application.port.out.ListPersonsPort;
import com.faceattend_edu.identity_service.domain.model.Person;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@RequiredArgsConstructor
@Service
public class ListPersonsUseCaseImpl implements ListPersonsUseCase {

    private final ListPersonsPort listPersonsPort;

    @Override
    public List<Person> listPersons(int pageIndex, int limit) {
        return listPersonsPort.listPersons(pageIndex, limit);
    }

    @Override
    public long countPersons() {
        return listPersonsPort.countPersons();
    }

    @Override
    public List<Person> listPersons(int pageIndex, int limit, java.util.Set<java.util.UUID> personIds) {
        return personIds.isEmpty() ? List.of() : listPersonsPort.listPersons(pageIndex, limit, personIds);
    }

    @Override
    public long countPersons(java.util.Set<java.util.UUID> personIds) {
        return personIds.isEmpty() ? 0 : listPersonsPort.countPersons(personIds);
    }
}
