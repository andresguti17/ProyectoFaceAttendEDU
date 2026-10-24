package com.faceattend_edu.identity_service.adapter.out.persistence.crypto;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Encrypts a personal-data column on write and decrypts it on read (see {@link PiiCipher}). */
@Converter
public class PiiStringConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return attribute == null ? null : PiiCipher.current().encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return dbData == null ? null : PiiCipher.current().decrypt(dbData);
    }
}
