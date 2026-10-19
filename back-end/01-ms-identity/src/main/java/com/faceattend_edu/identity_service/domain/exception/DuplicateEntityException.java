package com.faceattend_edu.identity_service.domain.exception;

public class DuplicateEntityException extends DomainException {
    private static final long serialVersionUID = 1L;

    private final String entityName;
    private final Object duplicateValue;

    public DuplicateEntityException(String entityName, Object duplicateValue) {
        super(entityName + " already exists with value=" + duplicateValue);
        this.entityName = entityName;
        this.duplicateValue = duplicateValue;
    }

    public String getEntityName() { return entityName; }
    public Object getDuplicateValue() { return duplicateValue; }
}
