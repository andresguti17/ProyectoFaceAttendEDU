package com.faceattend_edu.identity_service.application.port.out;

public interface HashPasswordPort {

    String hash(String rawPassword);

    boolean matches(String rawPassword, String passwordHash);
}
