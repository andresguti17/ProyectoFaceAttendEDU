package com.faceattend_edu.authorization_service.application.usecase;

import com.faceattend_edu.authorization_service.domain.model.Role;
import com.faceattend_edu.authorization_service.domain.port.in.ListRolesUseCase;
import com.faceattend_edu.authorization_service.domain.port.out.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ListRolesUseCaseImpl implements ListRolesUseCase {

    private final RoleRepository roleRepository;

    @Override
    public List<Role> listRoles() {
        return roleRepository.findAll();
    }
}
