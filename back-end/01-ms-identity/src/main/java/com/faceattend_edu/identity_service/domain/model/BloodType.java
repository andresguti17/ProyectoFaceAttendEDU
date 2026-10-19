package com.faceattend_edu.identity_service.domain.model;

public enum BloodType {
    A_POSITIVE("A+"),
    A_NEGATIVE("A-"),
    B_POSITIVE("B+"),
    B_NEGATIVE("B-"),
    AB_POSITIVE("AB+"),
    AB_NEGATIVE("AB-"),
    O_POSITIVE("O+"),
    O_NEGATIVE("O-");

    private final String code;

    BloodType(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static BloodType fromCode(String code) {
        if (code == null || code.isBlank()) return null;
        String normalized = code.trim();
        for (BloodType value : values()) {
            if (value.code.equalsIgnoreCase(normalized) || value.name().equalsIgnoreCase(normalized)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown blood type: " + code);
    }
}
