package com.faceattend_edu.identity_service.adapter.in.web.mapper;

import com.faceattend_edu.identity_service.adapter.in.web.dto.PersonDto;
import com.faceattend_edu.identity_service.domain.model.BloodType;
import com.faceattend_edu.identity_service.domain.model.Person;
import org.springframework.stereotype.Component;

@Component
public class PersonWebMapper {

    public PersonDto toDto(Person domain) {
        if (domain == null) return null;
        PersonDto dto = new PersonDto();
        dto.setPersonId(domain.getPersonId());
        dto.setDocumentNumber(domain.getDocumentNumber());
        dto.setName(domain.getName());
        dto.setLastName(domain.getLastName());
        dto.setEmail(domain.getEmail());
        dto.setPhone(domain.getPhone());
        dto.setDocumentType(domain.getDocumentType());
        dto.setBloodType(domain.getBloodType() == null ? null : domain.getBloodType().getCode());
        dto.setBirthDate(domain.getBirthDate());
        dto.setAddress(domain.getAddress());
        dto.setStatus(domain.getStatus());
        return dto;
    }

    public Person toDomain(PersonDto dto) {
        if (dto == null) return null;
        Person person = new Person();
        person.setPersonId(dto.getPersonId());
        person.setDocumentNumber(dto.getDocumentNumber());
        person.setName(dto.getName());
        person.setLastName(dto.getLastName());
        person.setEmail(dto.getEmail());
        person.setPhone(dto.getPhone());
        person.setDocumentType(dto.getDocumentType());
        person.setBloodType(BloodType.fromCode(dto.getBloodType()));
        person.setBirthDate(dto.getBirthDate());
        person.setAddress(dto.getAddress());
        person.setStatus(dto.getStatus());
        return person;
    }
}
