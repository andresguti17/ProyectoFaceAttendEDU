package com.faceattend_edu.authorization_service.domain.port.in;

import com.faceattend_edu.authorization_service.domain.model.Permission;
import java.util.List;

public interface ListPermissionsUseCase {
    List<Permission> listPermissions();
}
