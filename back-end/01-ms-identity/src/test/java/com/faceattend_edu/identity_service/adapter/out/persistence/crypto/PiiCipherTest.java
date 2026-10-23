package com.faceattend_edu.identity_service.adapter.out.persistence.crypto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Ley 1581: personal data encrypted at rest (AES-256-GCM) with blind indexes")
class PiiCipherTest {

    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);
    private static final String OTHER_KEY = Base64.getEncoder().encodeToString("0123456789abcdef0123456789abcdef".getBytes());
    private final PiiCipher cipher = new PiiCipher(KEY, OTHER_KEY);

    @Test
    void roundTripsAndNeverStoresThePlainValue() {
        String stored = cipher.encrypt("1015407712");

        assertThat(stored).startsWith("enc:v1:").doesNotContain("1015407712");
        assertThat(cipher.decrypt(stored)).isEqualTo("1015407712");
    }

    @Test
    void theSameValueEncryptsDifferentlyEachTime() {
        assertThat(cipher.encrypt("ana@sede.edu.co")).isNotEqualTo(cipher.encrypt("ana@sede.edu.co"));
    }

    @Test
    void legacyPlainValuesAreReadAsIsAndEncryptionIsNotAppliedTwice() {
        assertThat(cipher.decrypt("O+")).isEqualTo("O+");
        String once = cipher.encrypt("O+");
        assertThat(cipher.encrypt(once)).isEqualTo(once);
    }

    @Test
    void aTamperedValueOrAnotherKeyFailsInsteadOfReturningGarbage() {
        String stored = cipher.encrypt("3001234567");
        // Flip one bit of the decoded bytes (the GCM tag): editing a base64 character could
        // land on padding bits the decoder ignores and leave the bytes unchanged.
        byte[] raw = Base64.getDecoder().decode(stored.substring(PiiCipher.PREFIX.length()));
        raw[raw.length - 1] ^= 1;
        String tampered = PiiCipher.PREFIX + Base64.getEncoder().encodeToString(raw);

        assertThatThrownBy(() -> cipher.decrypt(tampered)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new PiiCipher(OTHER_KEY, KEY).decrypt(stored)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void theBlindIndexIsStableAndKeyed() {
        assertThat(cipher.hash("ana@sede.edu.co")).isEqualTo(cipher.hash("ana@sede.edu.co")).hasSize(64);
        assertThat(new PiiCipher(KEY, KEY).hash("ana@sede.edu.co")).isNotEqualTo(cipher.hash("ana@sede.edu.co"));
        assertThat(cipher.hash(" ")).isNull();
    }

    @Test
    void missingOrShortKeysStopTheService() {
        assertThatThrownBy(() -> new PiiCipher(null, KEY)).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> new PiiCipher(Base64.getEncoder().encodeToString(new byte[16]), KEY))
                .isInstanceOf(IllegalStateException.class);
    }
}
