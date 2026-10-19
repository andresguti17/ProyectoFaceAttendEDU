package com.faceattend_edu.identity_service.shared.util;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Normalización y validación de correo usada por login y por el flujo de
 * recuperación, para que las dos rutas definan "email válido" igual.
 */
public final class Emails {

    private static final Pattern PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private Emails() {
    }

    public static boolean isWellFormed(String email) {
        return email != null && PATTERN.matcher(email.trim()).matches();
    }

    /** Minúsculas + trim: la clave del almacén de códigos y el lookup comparten forma. */
    public static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
