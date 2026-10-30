package com.faceattend_edu.identity_service.domain.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PersonValidationTest {

    private Person valid() {
        Person p = new Person();
        p.setDocumentNumber("123");
        p.setName("Ana");
        p.setLastName("Pérez");
        p.setDocumentType("CC");
        return p;
    }

    @Test
    void acceptsEveryAllowedDocumentType() {
        for (String type : new String[] {"CC", "TI", "CE", "PP"}) {
            Person p = valid();
            p.setDocumentType(type);
            assertDoesNotThrow(p::validate);
        }
    }

    @Test
    void rejectsUnknownDocumentType() {
        Person p = valid();
        p.setDocumentType("XX");
        assertThrows(IllegalArgumentException.class, p::validate);
    }

    @Test
    void acceptsAPastBirthDate() {
        Person p = valid();
        p.setBirthDate(LocalDate.of(2005, 3, 5));
        assertDoesNotThrow(p::validate);
    }

    @Test
    void rejectsAFutureBirthDate() {
        Person p = valid();
        p.setBirthDate(LocalDate.now().plusDays(1));
        assertThrows(IllegalArgumentException.class, p::validate);
    }

    @Test
    void rejectsABirthDateBefore1900() {
        Person p = valid();
        p.setBirthDate(LocalDate.of(1899, 12, 31));
        assertThrows(IllegalArgumentException.class, p::validate);
    }

    @Test
    void rejectsTextLongerThanTheColumns() {
        Person p = valid();
        p.setName("a".repeat(10_000));
        assertThrows(IllegalArgumentException.class, p::validate);
    }
}
