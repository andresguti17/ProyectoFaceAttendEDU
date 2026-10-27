package com.faceattend_edu.identity_service.application.support;

/**
 * Datos personales que no deben quedar en claro en los logs. Un id de sesión es un bearer
 * (quien lo lee en un log puede actuar como el usuario) y un correo identifica a una persona:
 * en los registros va el usuario (userId) o el valor enmascarado.
 */
public final class LogMask {

    private LogMask() {}

    /** "ana.perez@example.com" becomes "a***@example.com"; anything that is not an address becomes "***". */
    public static String email(String email) {
        if (email == null) return "***";
        int at = email.indexOf('@');
        if (at <= 0) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }
}
