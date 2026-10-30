package com.faceattend_edu.attendance_service.infrastructure.persistence;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordFilter;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecordSlice;
import com.faceattend_edu.attendance_service.domain.model.JustificationFilter;
import com.faceattend_edu.attendance_service.domain.model.JustificationSlice;
import com.faceattend_edu.attendance_service.infrastructure.persistence.adapter.AttendanceRecordPersistenceAdapter;
import com.faceattend_edu.attendance_service.infrastructure.persistence.adapter.JustificationPersistenceAdapter;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.AttendanceRecordJpaEntity;
import com.faceattend_edu.attendance_service.infrastructure.persistence.entity.JustificationJpaEntity;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.AttendanceRecordPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.JustificationPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.JustificationJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Status filters against real PostgreSQL. In production attendance_status and
 * review_status are native ENUM types and the JDBC URL carries
 * {@code ?stringtype=unspecified}, so PostgreSQL casts every status parameter to
 * the enum, even when its flag turns the filter off. H2 has neither, which is
 * how an empty-string placeholder made every unfiltered listing fail with
 * {@code invalid input value for enum attendance_status: ""}.
 */
@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
        // Quoted, columnDefinition "TEXT" is not a PostgreSQL type.
        "spring.jpa.properties.hibernate.globally_quoted_identifiers_skip_column_definitions=true",
        // The attendance schema does not exist until Hibernate creates it.
        "spring.datasource.hikari.schema=public"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({AttendanceRecordPersistenceAdapter.class, AttendanceRecordPersistenceMapper.class,
        JustificationPersistenceAdapter.class, JustificationPersistenceMapper.class})
@DisplayName("IEEE 829 TC-05: status filters against PostgreSQL native enums")
class StatusEnumSearchPostgresTest {

    @Container
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> {
            String url = POSTGRES.getJdbcUrl();
            return url + (url.contains("?") ? "&" : "?") + "stringtype=unspecified";
        });
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired private JdbcTemplate jdbc;
    @Autowired private AttendanceRecordJpaRepository records;
    @Autowired private JustificationJpaRepository justifications;
    @Autowired private AttendanceRecordPersistenceAdapter recordAdapter;
    @Autowired private JustificationPersistenceAdapter justificationAdapter;

    /** Hibernate creates the columns as varchar; turn them into the enums the migrations define. */
    @BeforeEach
    void nativeEnums() {
        jdbc.execute("create type attendance.attendance_status as enum ('Present', 'Absent', 'Late', 'Justified')");
        jdbc.execute("create type attendance.review_status as enum ('Pending', 'Approved', 'Rejected')");
        jdbc.execute("alter table attendance.attendance_record alter column attendance_status"
                + " type attendance.attendance_status using attendance_status::attendance.attendance_status");
        jdbc.execute("alter table attendance.justification alter column review_status"
                + " type attendance.review_status using review_status::attendance.review_status");
    }

    private AttendanceRecordJpaEntity record(long session, long actor, String status) {
        AttendanceRecordJpaEntity e = new AttendanceRecordJpaEntity();
        e.setClassSessionId(session);
        e.setAcademicActorId(actor);
        e.setAttendanceStatus(status);
        e.setCaptureMethod("MANUAL");
        e.setCreatedAt(Instant.now());
        return records.save(e);
    }

    private void justification(long recordId, String status) {
        JustificationJpaEntity e = new JustificationJpaEntity();
        e.setAttendanceRecordId(recordId);
        e.setJustificationTypeId(1);
        e.setReason("Medical leave");
        e.setSubmittedAt(Instant.now());
        e.setReviewStatus(status);
        e.setCreatedAt(Instant.now());
        justifications.save(e);
    }

    @Test
    @DisplayName("TC-05-P04: a session's attendance lists every status when no status filter is given")
    void sessionAttendanceWithoutStatusFilterListsEveryRecord() {
        // Arrange
        record(300L, 1L, "Present");
        record(300L, 2L, "Absent");
        record(300L, 3L, "Late");
        record(301L, 1L, "Present");
        records.flush();

        // Act
        AttendanceRecordSlice slice = recordAdapter.search(AttendanceRecordFilter.bySession(300L, null), 0, null);

        // Assert
        assertThat(slice.total()).isEqualTo(3);
        assertThat(slice.items()).extracting(AttendanceRecord::getAttendanceStatus)
                .containsExactly("Present", "Absent", "Late");
    }

    @Test
    @DisplayName("TC-05-P05: the record listing pages without a status filter and still filters by status")
    void recordListingWithAndWithoutStatusFilter() {
        // Arrange
        record(310L, 1L, "Present");
        record(310L, 2L, "Absent");
        record(311L, 1L, "Absent");
        records.flush();

        // Act
        AttendanceRecordSlice all = recordAdapter.search(new AttendanceRecordFilter(null, null, null, null), 0, 2);
        AttendanceRecordSlice absent = recordAdapter.search(new AttendanceRecordFilter(null, null, "Absent", null), 0, null);

        // Assert
        assertThat(all.total()).isEqualTo(3);
        assertThat(all.items()).hasSize(2);
        assertThat(absent.total()).isEqualTo(2);
    }

    @Test
    @DisplayName("TC-05-P06: justifications list every review status when no status filter is given")
    void justificationListingWithoutStatusFilter() {
        // Arrange
        justification(record(320L, 1L, "Absent").getAttendanceRecordId(), "Pending");
        justification(record(320L, 2L, "Absent").getAttendanceRecordId(), "Approved");
        justifications.flush();

        // Act
        JustificationSlice all = justificationAdapter.search(new JustificationFilter(null, null, null), 0, null);
        JustificationSlice pending = justificationAdapter.search(new JustificationFilter("Pending", null, null), 0, null);

        // Assert
        assertThat(all.total()).isEqualTo(2);
        assertThat(pending.total()).isEqualTo(1);
    }
}
