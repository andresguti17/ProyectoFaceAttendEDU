package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.Person;

import java.util.List;

public interface ListPersonsUseCase {

    List<Person> listPersons(int pageIndex, int limit);

    long countPersons();
}
