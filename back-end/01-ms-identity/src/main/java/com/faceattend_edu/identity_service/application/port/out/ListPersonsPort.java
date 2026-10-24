package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.Person;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface ListPersonsPort {

    /**
     * One page straight from SQL. Paging is not optional here: with a seeded school the table
     * holds thousands of rows and loading all of them per request was the dominant cost.
     */
    List<Person> listPersons(int pageIndex, int limit);

    long countPersons();

    /** One page of the persons in a caller's scope, by last name, straight from SQL. */
    List<Person> listPersons(int pageIndex, int limit, Set<UUID> personIds);

    long countPersons(Set<UUID> personIds);
}
