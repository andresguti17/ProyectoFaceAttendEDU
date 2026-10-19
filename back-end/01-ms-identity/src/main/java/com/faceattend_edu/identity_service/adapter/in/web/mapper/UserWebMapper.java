package com.faceattend_edu.identity_service.adapter.in.web.mapper;

import com.faceattend_edu.identity_service.adapter.in.web.dto.CreateUserRequest;
import com.faceattend_edu.identity_service.adapter.in.web.dto.UserDto;
import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import org.springframework.stereotype.Component;

@Component
public class UserWebMapper {

    public UserDto toDto(User domain) {
        if (domain == null) return null;
        UserDto dto = new UserDto();
        dto.setUserId(domain.getUserId());
        dto.setPersonId(domain.getPersonId() != null ? domain.getPersonId().getPersonId() : null);
        dto.setUsername(domain.getUsername());
        dto.setAuthenticationType(domain.getAuthenticationType());
        dto.setStatus(domain.getStatus());
        dto.setLastAccess(domain.getLastAccess());
        dto.setCreatedAt(domain.getCreatedAt());
        dto.setUpdatedAt(domain.getUpdatedAt());
        return dto;
    }

    public User toDomain(CreateUserRequest request) {
        if (request == null) return null;
        User user = new User();
        user.setPersonId(personReference(request.getPersonId()));
        user.setUsername(request.getUsername());
        user.setAuthenticationType(request.getAuthenticationType());
        return user;
    }

    public User toDomain(UserDto dto) {
        if (dto == null) return null;
        User user = new User();
        user.setUserId(dto.getUserId());
        user.setPersonId(personReference(dto.getPersonId()));
        user.setUsername(dto.getUsername());
        user.setAuthenticationType(dto.getAuthenticationType());
        user.setStatus(dto.getStatus());
        return user;
    }

    /**
     * identity.app_user.person_id is a plain cross-reference; only the identifier is
     * needed to persist the association, the rest of the aggregate stays owned by Person.
     */
    private Person personReference(java.util.UUID personId) {
        if (personId == null) return null;
        Person person = new Person();
        person.setPersonId(personId);
        return person;
    }
}
