package com.faceattend_edu.identity_service.adapter.out.persistence.crypto;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.UUID;

/**
 * El token de sesión (bearer) es un UUID aleatorio que solo conoce el cliente. En la tabla
 * {@code identity.user_session} se guarda únicamente este resumen, con la misma forma de UUID para
 * no cambiar el esquema: quien lea la tabla (respaldo, soporte, inyección) no obtiene bearers
 * utilizables. El token tiene 122 bits aleatorios, por lo que un SHA-256 sin sal no se puede
 * invertir ni adivinar por fuerza bruta.
 */
public final class SessionTokenHasher {

    private static final byte[] DOMAIN = "faceattend.session.v1:".getBytes(StandardCharsets.UTF_8);

    private SessionTokenHasher() {
    }

    public static UUID hash(UUID token) {
        if (token == null) return null;
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(DOMAIN);
            sha.update(ByteBuffer.allocate(16)
                    .putLong(token.getMostSignificantBits())
                    .putLong(token.getLeastSignificantBits())
                    .array());
            ByteBuffer digest = ByteBuffer.wrap(sha.digest());
            return new UUID(digest.getLong(), digest.getLong());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}
