package com.faceattend_edu.identity_service.config;

import com.faceattend_edu.identity_service.adapter.out.persistence.crypto.PiiCipher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Installs the personal-data cipher with keys from the environment only
 * (PII_ENCRYPTION_KEY, PII_HASH_KEY). The service does not start without them.
 */
@Configuration
@EnableScheduling // periodic PII backfill (PiiBackfillRunner)
public class PiiCryptoConfig {

    public PiiCryptoConfig(@Value("${faceattend.pii.encryption-key:}") String encryptionKey,
                           @Value("${faceattend.pii.hash-key:}") String hashKey) {
        PiiCipher.install(new PiiCipher(encryptionKey, hashKey));
    }
}
