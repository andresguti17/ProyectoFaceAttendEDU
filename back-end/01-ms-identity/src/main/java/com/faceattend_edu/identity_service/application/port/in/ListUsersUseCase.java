package com.faceattend_edu.identity_service.application.port.in;

import com.faceattend_edu.identity_service.domain.model.User;

import java.util.List;
import java.util.Set;
import java.util.UUID;

public interface ListUsersUseCase {

    List<User> listUsers(int pageIndex, int limit);

    long countUsers();

    /** Same page/count restricted to a person scope (school admin); never an empty set. */
    List<User> listUsers(int pageIndex, int limit, Set<UUID> personIds);

    long countUsers(Set<UUID> personIds);
}
