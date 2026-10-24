package com.faceattend_edu.identity_service.adapter.out.persistence.crypto;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Column encryption for personal data at rest (Ley 1581 art. 4-g security principle;
 * AES-256-GCM per security-rules.md A02). Values are stored as {@code enc:v1:<base64(nonce|ciphertext)>};
 * anything without that prefix is a row written before encryption and is returned as is,
 * until the startup backfill rewrites it.
 *
 * <p>Lookups (login by e-mail, uniqueness) cannot use a random ciphertext, so a keyed
 * HMAC-SHA256 of the normalized value ("blind index") is stored next to it.</p>
 */
public final class PiiCipher {

    static final String PREFIX = "enc:v1:";
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private static volatile PiiCipher current;

    private final SecretKeySpec encryptionKey;
    private final SecretKeySpec hashKey;

    public PiiCipher(String base64EncryptionKey, String base64HashKey) {
        byte[] enc = decodeKey(base64EncryptionKey, "PII_ENCRYPTION_KEY");
        byte[] mac = decodeKey(base64HashKey, "PII_HASH_KEY");
        this.encryptionKey = new SecretKeySpec(enc, "AES");
        this.hashKey = new SecretKeySpec(mac, "HmacSHA256");
    }

    public static void install(PiiCipher cipher) {
        current = cipher;
    }

    /** The cipher configured by Spring; JPA slice tests fall back to the same keys given as system properties. */
    public static PiiCipher current() {
        PiiCipher c = current;
        if (c == null) {
            synchronized (PiiCipher.class) {
                if (current == null) {
                    current = new PiiCipher(System.getProperty("faceattend.pii.encryption-key"),
                            System.getProperty("faceattend.pii.hash-key"));
                }
                c = current;
            }
        }
        return c;
    }

    public String encrypt(String plain) {
        if (plain == null || plain.startsWith(PREFIX)) return plain;
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            RANDOM.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(TAG_BITS, nonce));
            byte[] ct = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(nonce.length + ct.length).put(nonce).put(ct).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Cannot encrypt personal data", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null || !stored.startsWith(PREFIX)) return stored;
        try {
            byte[] raw = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, new GCMParameterSpec(TAG_BITS, raw, 0, NONCE_BYTES));
            return new String(cipher.doFinal(raw, NONCE_BYTES, raw.length - NONCE_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // Wrong key or tampered value: never hand back garbage as if it were the data.
            throw new IllegalStateException("Cannot decrypt personal data (wrong key or tampered value)", e);
        }
    }

    /** Blind index of an already normalized value; null stays null. */
    public String hash(String normalized) {
        if (normalized == null || normalized.isBlank()) return null;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(hashKey);
            return HexFormat.of().formatHex(mac.doFinal(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Cannot hash personal data", e);
        }
    }

    public static boolean isEncrypted(String stored) {
        return stored != null && stored.startsWith(PREFIX);
    }

    private static byte[] decodeKey(String base64, String name) {
        if (base64 == null || base64.isBlank()) {
            throw new IllegalStateException(name + " is required (base64 of 32 random bytes: openssl rand -base64 32)");
        }
        byte[] key = Base64.getDecoder().decode(base64.trim());
        if (key.length != 32) throw new IllegalStateException(name + " must decode to 32 bytes");
        return key;
    }
}
