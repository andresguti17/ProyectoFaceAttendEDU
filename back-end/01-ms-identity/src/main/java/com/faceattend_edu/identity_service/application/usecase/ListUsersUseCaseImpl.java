package com.faceattend_edu.identity_service.application.usecase;

import com.faceattend_edu.identity_service.application.port.in.ListUsersUseCase;
import com.faceattend_edu.identity_service.application.port.out.ListUsersPort;
import com.faceattend_edu.identity_service.domain.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RequiredArgsConstructor
@Service
public class ListUsersUseCaseImpl implements ListUsersUseCase {

    private final ListUsersPort listUsersPort;

    @Override
    public List<User> listUsers(int pageIndex, int limit) {
        return listUsersPort.listUsers(pageIndex, limit);
    }

    @Override
    public long countUsers() {
        return listUsersPort.countUsers();
    }

    @Override
    public List<User> listUsers(int pageIndex, int limit, Set<UUID> personIds) {
        return listUsersPort.listUsers(pageIndex, limit, personIds);
    }

    @Override
    public long countUsers(Set<UUID> personIds) {
        return listUsersPort.countUsers(personIds);
    }
}
