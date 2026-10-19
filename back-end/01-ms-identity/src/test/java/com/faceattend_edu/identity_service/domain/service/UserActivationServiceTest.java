package com.faceattend_edu.identity_service.domain.service;

import com.faceattend_edu.identity_service.domain.model.Person;
import com.faceattend_edu.identity_service.domain.model.User;
import com.faceattend_edu.identity_service.domain.exception.DomainException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;

class UserActivationServiceTest {

    @Test
    void shouldActivateUserWhenPersonIsActive() {
        Person person = new Person();
        person.setStatus(true);
        
        User user = new User();
        user.setPersonId(person);
        
        UserActivationService service = new UserActivationService();
        service.activateUser(user);
        
        assertTrue(user.isActive());
    }

    @Test
    void shouldThrowExceptionWhenPersonIsInactive() {
        Person person = new Person();
        person.setStatus(false);
        
        User user = new User();
        user.setPersonId(person);
        
        UserActivationService service = new UserActivationService();
        assertThrows(DomainException.class, () -> service.activateUser(user));
    }
}
