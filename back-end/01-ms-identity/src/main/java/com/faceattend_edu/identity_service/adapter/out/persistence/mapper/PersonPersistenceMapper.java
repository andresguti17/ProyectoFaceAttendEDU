package com.faceattend_edu.identity_service.adapter.out.persistence.mapper;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.PersonJpaEntity;
import com.faceattend_edu.identity_service.domain.model.BloodType;
import com.faceattend_edu.identity_service.domain.model.Person;
import org.springframework.stereotype.Component;

@Component
public class PersonPersistenceMapper {

    public Person toDomain(PersonJpaEntity entity) {
        if (entity == null) return null;
        Person domain = new Person();
        domain.setPersonId(entity.getPersonId());
        domain.setDocumentNumber(entity.getDocumentNumber());
        domain.setName(entity.getName());
        domain.setLastName(entity.getLastName());
        domain.setEmail(entity.getEmail());
        domain.setPhone(entity.getPhone());
        domain.setDocumentType(entity.getDocumentType());
        domain.setBloodType(BloodType.fromCode(entity.getBloodType()));
        domain.setBirthDate(entity.getBirthDate());
        domain.setAddress(entity.getAddress());
        domain.setStatus(entity.getStatus());
        domain.setCreatedAt(entity.getCreatedAt());
        domain.setUpdatedAt(entity.getUpdatedAt());
        domain.setDeletedAt(entity.getDeletedAt());
        domain.setCreatedBy(entity.getCreatedBy());
        domain.setUpdatedBy(entity.getUpdatedBy());
        domain.setDeletedBy(entity.getDeletedBy());
        domain.setRowVersion(entity.getRowVersion());
        return domain;
    }

    public PersonJpaEntity toEntity(Person domain) {
        if (domain == null) return null;
        PersonJpaEntity entity = new PersonJpaEntity();
        entity.setPersonId(domain.getPersonId());
        entity.setDocumentNumber(domain.getDocumentNumber());
        entity.setName(domain.getName());
        entity.setLastName(domain.getLastName());
        entity.setEmail(domain.getEmail());
        entity.setPhone(domain.getPhone());
        entity.setDocumentType(domain.getDocumentType());
        entity.setBloodType(domain.getBloodType() == null ? null : domain.getBloodType().getCode());
        entity.setBirthDate(domain.getBirthDate());
        entity.setAddress(domain.getAddress());
        entity.setStatus(domain.getStatus());
        entity.setCreatedAt(domain.getCreatedAt());
        entity.setUpdatedAt(domain.getUpdatedAt());
        entity.setDeletedAt(domain.getDeletedAt());
        entity.setCreatedBy(domain.getCreatedBy());
        entity.setUpdatedBy(domain.getUpdatedBy());
        entity.setDeletedBy(domain.getDeletedBy());
        entity.setRowVersion(domain.getRowVersion());
        return entity;
    }
}
