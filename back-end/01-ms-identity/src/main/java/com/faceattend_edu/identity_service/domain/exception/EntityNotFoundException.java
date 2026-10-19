package com.faceattend_edu.identity_service.domain.exception;

public class EntityNotFoundException extends DomainException {
    private static final long serialVersionUID = 1L;

    private final String entityName;
    private final Object identifier;

    public EntityNotFoundException(String entityName, Object identifier) {
        super(entityName + " not found with identifier=" + identifier);
        this.entityName = entityName;
        this.identifier = identifier;
    }

    public String getEntityName() { return entityName; }
    public Object getIdentifier() { return identifier; }
}
