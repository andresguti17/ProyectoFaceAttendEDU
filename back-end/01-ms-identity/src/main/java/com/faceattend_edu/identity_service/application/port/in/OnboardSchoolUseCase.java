package com.faceattend_edu.identity_service.application.port.in;

import java.util.UUID;

/**
 * Public school sign-up: registers a school (sede) together with its first
 * administrator. Both are created pending activation; a Super Administrador
 * activates them afterwards.
 */
public interface OnboardSchoolUseCase {

    record School(String code, String name, String cityName, String address, String phone, String email) {}

    record Admin(String documentType, String documentNumber, String name, String lastName,
                 String email, String phone, String username, String password,
                 String privacyPolicyVersion, boolean biometricAccepted) {}

    record Result(long schoolId, UUID personId, UUID userId) {}

    Result onboard(School school, Admin admin);
}
