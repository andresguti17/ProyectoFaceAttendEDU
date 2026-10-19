package com.faceattend_edu.attendance_service.domain.exception;

public class EntityNotFoundException extends DomainException {
    private final String entityName;
    private final Object identifier;
    public EntityNotFoundException(String entityName, Object identifier) {
        super(entityName + " not found with identifier=" + identifier);
        this.entityName = entityName;
        this.identifier = identifier;
    }
    public String getEntityName(){ return entityName; }
    public Object getIdentifier(){ return identifier; }
}
