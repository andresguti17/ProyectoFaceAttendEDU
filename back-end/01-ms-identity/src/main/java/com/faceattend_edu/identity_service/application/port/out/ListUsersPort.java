package com.faceattend_edu.identity_service.application.port.out;

import com.faceattend_edu.identity_service.domain.model.User;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface ListUsersPort {

    /**
     * One page straight from SQL. Paging is not optional here: with a seeded school the table
     * holds thousands of rows and loading all of them per request was the dominant cost.
     */
    List<User> listUsers(int pageIndex, int limit);

    long countUsers();

    /** Same page/count restricted to a person scope (school admin); never an empty set. */
    List<User> listUsers(int pageIndex, int limit, Set<UUID> personIds);

    long countUsers(Set<UUID> personIds);
}
