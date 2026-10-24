package com.faceattend_edu.identity_service.adapter.out.persistence;

import com.faceattend_edu.identity_service.adapter.out.persistence.crypto.PiiBackfillRunner;
import com.faceattend_edu.identity_service.adapter.out.persistence.entity.PersonJpaEntity;
import com.faceattend_edu.identity_service.adapter.out.persistence.repository.PersonJpaRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Ley 1581: a direct query to the database cannot read the document number, e-mail,
 * phone or blood type, while the application still reads them and finds people by e-mail.
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true"
})
@DisplayName("Personal data encrypted at rest in identity.person")
class PersonPiiPersistenceTest {

    @Autowired PersonJpaRepository repository;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager txManager;

    private PersonJpaEntity person(String document, String email) {
        PersonJpaEntity p = new PersonJpaEntity();
        p.setDocumentType("CC");
        p.setDocumentNumber(document);
        p.setName("Ana");
        p.setLastName("Rios");
        p.setEmail(email);
        p.setPhone("3001234567");
        p.setBloodType("O+");
        p.setStatus(true);
        p.setCreatedAt(LocalDateTime.now());
        return p;
    }

    private Object[] rawRow(UUID id) {
        return (Object[]) em.createNativeQuery(
                        "select \"document_number\", \"email\", \"phone\", \"blood_type\", \"email_hash\", \"document_hash\" from \"identity\".\"person\" where \"person_id\" = ?1")
                .setParameter(1, id).getSingleResult();
    }

    @Test
    void storedColumnsAreCiphertextAndTheAppReadsPlainValues() {
        PersonJpaEntity saved = repository.saveAndFlush(person("1015407712", "Ana@Sede.edu.co"));
        em.clear();

        Object[] raw = rawRow(saved.getPersonId());
        for (int i = 0; i < 4; i++) {
            assertThat(String.valueOf(raw[i])).startsWith("enc:v1:");
        }
        assertThat(String.valueOf(raw[0])).doesNotContain("1015407712");
        assertThat(raw[4]).isNotNull();
        assertThat(raw[5]).isNotNull();

        PersonJpaEntity loaded = repository.findById(saved.getPersonId()).orElseThrow();
        assertThat(loaded.getDocumentNumber()).isEqualTo("1015407712");
        assertThat(loaded.getEmail()).isEqualTo("Ana@Sede.edu.co");
        assertThat(loaded.getBloodType()).isEqualTo("O+");
    }

    @Test
    void theEmailBlindIndexIgnoresCaseAndSpaces() {
        PersonJpaEntity a = repository.saveAndFlush(person("1", "ana@sede.edu.co"));
        PersonJpaEntity b = person("2", "  ANA@SEDE.EDU.CO ");
        b.refreshHashes();
        assertThat(b.getEmailHash()).isEqualTo(a.getEmailHash());
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void legacyPlainRowsAreEncryptedByTheBackfill() {
        TransactionTemplate tx = new TransactionTemplate(txManager);
        UUID id = UUID.randomUUID();
        tx.executeWithoutResult(s -> em.createNativeQuery(
                        "insert into \"identity\".\"person\" (\"person_id\", \"document_type\", \"document_number\", \"name\", \"last_name\", \"email\", \"status\", \"created_at\", \"row_version\") "
                                + "values (?1, 'CC', '99887766', 'Old', 'Row', 'old@sede.edu.co', true, ?2, 1)")
                .setParameter(1, id).setParameter(2, LocalDateTime.now()).executeUpdate());

        // Before the backfill the legacy row is still readable.
        String before = tx.execute(s -> repository.findById(id).orElseThrow().getDocumentNumber());
        assertThat(before).isEqualTo("99887766");

        new PiiBackfillRunner(repository, tx).run(null);

        Object[] raw = tx.execute(s -> rawRow(id));
        assertThat(String.valueOf(raw[0])).startsWith("enc:v1:");
        assertThat(String.valueOf(raw[1])).startsWith("enc:v1:");
        assertThat(raw[5]).isNotNull();
        String after = tx.execute(s -> repository.findById(id).orElseThrow().getEmail());
        assertThat(after).isEqualTo("old@sede.edu.co");
        tx.executeWithoutResult(s -> repository.deleteById(id));
    }
}
