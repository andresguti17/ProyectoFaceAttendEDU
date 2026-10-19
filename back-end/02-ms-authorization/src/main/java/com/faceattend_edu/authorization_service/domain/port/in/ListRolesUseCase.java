package com.faceattend_edu.authorization_service.domain.port.in;

import com.faceattend_edu.authorization_service.domain.model.Role;
import java.util.List;

public interface ListRolesUseCase {
    List<Role> listRoles();
}
