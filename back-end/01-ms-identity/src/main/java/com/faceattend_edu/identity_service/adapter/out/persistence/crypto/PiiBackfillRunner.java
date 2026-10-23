package com.faceattend_edu.identity_service.adapter.out.persistence.crypto;

import com.faceattend_edu.identity_service.adapter.out.persistence.entity.PersonJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.PersonJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;

/**
 * Encrypts and indexes the persons written before column encryption existed. Idempotent:
 * it only touches rows without a document blind index, in small transactions, so it can be
 * interrupted and restarted. Until a row is processed it stays readable (the converter
 * passes plaintext through) and the login falls back to the plain e-mail for it.
 *
 * <p>It also runs every few minutes: rows written outside the service (the first admin from
 * database/scripts/bootstrap-admin.sh is inserted with SQL) get encrypted without a restart.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PiiBackfillRunner implements ApplicationRunner {

    private static final int BATCH = 200;

    private final PersonJpaRepository repository;
    private final TransactionTemplate transactionTemplate;

    @Scheduled(initialDelayString = "${faceattend.privacy.pii-backfill-interval-ms:300000}",
            fixedDelayString = "${faceattend.privacy.pii-backfill-interval-ms:300000}")
    public void runPeriodically() {
        run(null);
    }

    @Override
    public void run(ApplicationArguments args) {
        int total = 0;
        try {
            while (true) {
                List<UUID> ids = repository.findIdsWithoutBlindIndex(PageRequest.of(0, BATCH));
                if (ids.isEmpty()) break;
                Integer done = transactionTemplate.execute(status -> {
                    List<PersonJpaEntity> persons = repository.findAllById(ids);
                    // Recomputing the hashes makes the row dirty; the full UPDATE rewrites the
                    // personal-data columns through the converter, i.e. encrypted.
                    persons.forEach(PersonJpaEntity::refreshHashes);
                    repository.saveAll(persons);
                    return persons.size();
                });
                if (done == null || done == 0) break;
                total += done;
            }
            if (total > 0) log.info("Encrypted and indexed personal data of {} existing persons", total);
        } catch (RuntimeException e) {
            // A duplicate between legacy rows (now caught by the blind-index uniqueness) must not stop the service.
            log.error("Personal-data backfill stopped after {} rows: {}", total, e.getMessage());
        }
    }
}
