package com.faceattend_edu.attendance_service.infrastructure.persistence;

import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.model.Justification;
import com.faceattend_edu.attendance_service.domain.model.JustificationType;
import com.faceattend_edu.attendance_service.domain.model.SupportingDocument;
import com.faceattend_edu.attendance_service.infrastructure.persistence.adapter.JustificationPersistenceAdapter;
import com.faceattend_edu.attendance_service.infrastructure.persistence.adapter.JustificationTypePersistenceAdapter;
import com.faceattend_edu.attendance_service.infrastructure.persistence.adapter.SupportingDocumentPersistenceAdapter;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.AttendanceRecordPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.JustificationPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.JustificationTypePersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.mapper.SupportingDocumentPersistenceMapper;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.JustificationJpaRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.JustificationTypeJpaRepository;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.SupportingDocumentJpaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("Attendance persistence: mappers keep every field, adapters delegate")
class AttendancePersistenceTest {

    /** Sets every non-static field to a distinct sample value of its type, so a dropped column shows up. */
    static <T> T filled(T target) {
        int n = 1;
        for (Class<?> c = target.getClass(); c != Object.class; c = c.getSuperclass()) {
            for (Field f : c.getDeclaredFields()) {
                if (Modifier.isStatic(f.getModifiers()) || Modifier.isFinal(f.getModifiers())) continue;
                Object value = sample(f.getType(), n++);
                if (value == null) continue;
                try {
                    f.setAccessible(true);
                    f.set(target, value);
                } catch (IllegalAccessException e) {
                    throw new IllegalStateException(e);
                }
            }
        }
        return target;
    }

    private static Object sample(Class<?> type, int n) {
        if (type == Long.class || type == long.class) return (long) n;
        if (type == Integer.class || type == int.class) return n;
        if (type == Short.class || type == short.class) return (short) n;
        if (type == Double.class || type == double.class) return n + 0.5;
        if (type == Boolean.class || type == boolean.class) return true;
        if (type == String.class) return "value-" + n;
        if (type == BigDecimal.class) return new BigDecimal(n + ".25");
        if (type == Instant.class) return Instant.parse("2026-10-01T10:00:00Z").plusSeconds(n);
        if (type == LocalDate.class) return LocalDate.of(2026, 10, n % 28 + 1);
        if (type == LocalTime.class) return LocalTime.of(n % 24, 0);
        if (type == UUID.class) return new UUID(0, n);
        if (type.isEnum()) return type.getEnumConstants()[0];
        return null;
    }

    @Test
    void everyMapperRoundTripsEveryField() {
        AttendanceRecordPersistenceMapper records = new AttendanceRecordPersistenceMapper();
        AttendanceRecord record = filled(new AttendanceRecord());
        assertThat(records.toDomain(records.toEntity(record))).usingRecursiveComparison().isEqualTo(record);

        JustificationPersistenceMapper justifications = new JustificationPersistenceMapper();
        Justification justification = filled(new Justification());
        assertThat(justifications.toDomain(justifications.toEntity(justification))).usingRecursiveComparison().isEqualTo(justification);

        JustificationTypePersistenceMapper types = new JustificationTypePersistenceMapper();
        JustificationType type = filled(new JustificationType());
        assertThat(types.toDomain(types.toEntity(type))).usingRecursiveComparison().isEqualTo(type);

        SupportingDocumentPersistenceMapper documents = new SupportingDocumentPersistenceMapper();
        SupportingDocument document = filled(new SupportingDocument());
        assertThat(documents.toDomain(documents.toEntity(document))).usingRecursiveComparison().isEqualTo(document);

        assertThat(records.toDomain(null)).isNull();
        assertThat(justifications.toEntity(null)).isNull();
        assertThat(types.toDomain(null)).isNull();
        assertThat(documents.toEntity(null)).isNull();
    }

    @Test
    void justificationTypeAdapterResolvesGlobalAndSchoolTypes() {
        JustificationTypeJpaRepository jpa = mock(JustificationTypeJpaRepository.class);
        JustificationTypePersistenceMapper mapper = new JustificationTypePersistenceMapper();
        JustificationTypePersistenceAdapter adapter = new JustificationTypePersistenceAdapter(jpa, mapper);
        JustificationType type = filled(new JustificationType());
        when(jpa.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertThat(adapter.save(type).getName()).isEqualTo(type.getName());
        when(jpa.findById(1)).thenReturn(Optional.of(mapper.toEntity(type)));
        assertThat(adapter.findById(1)).isPresent();
        when(jpa.findByName("Médica")).thenReturn(Optional.empty());
        assertThat(adapter.findByName("Médica")).isEmpty();
        when(jpa.findByNameAndSchoolId("Médica", 1)).thenReturn(Optional.of(mapper.toEntity(type)));
        assertThat(adapter.findByNameAndSchoolId("Médica", 1)).isPresent();
        when(jpa.findByNameAndSchoolIdIsNull("Médica")).thenReturn(Optional.empty());
        assertThat(adapter.findByNameAndSchoolIdIsNull("Médica")).isEmpty();
        when(jpa.findAll()).thenReturn(List.of(mapper.toEntity(type)));
        assertThat(adapter.findAll()).hasSize(1);
        adapter.deleteById(1);
        verify(jpa).deleteById(1);
        when(jpa.existsById(1)).thenReturn(true);
        assertThat(adapter.existsById(1)).isTrue();
    }

    @Test
    void justificationAndDocumentAdaptersDelegateAndMap() {
        JustificationJpaRepository justifications = mock(JustificationJpaRepository.class);
        JustificationPersistenceMapper jMapper = new JustificationPersistenceMapper();
        JustificationPersistenceAdapter jAdapter = new JustificationPersistenceAdapter(justifications, jMapper);
        Justification justification = filled(new Justification());
        when(justifications.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertThat(jAdapter.save(justification).getReason()).isEqualTo(justification.getReason());
        when(justifications.findById(1L)).thenReturn(Optional.of(jMapper.toEntity(justification)));
        assertThat(jAdapter.findById(1L)).isPresent();
        when(justifications.findByAttendanceRecordId(2L)).thenReturn(Optional.empty());
        assertThat(jAdapter.findByAttendanceRecordId(2L)).isEmpty();
        when(justifications.findAll()).thenReturn(List.of(jMapper.toEntity(justification)));
        assertThat(jAdapter.findAll()).hasSize(1);
        jAdapter.deleteById(1L);
        verify(justifications).deleteById(1L);
        when(justifications.existsById(1L)).thenReturn(false);
        assertThat(jAdapter.existsById(1L)).isFalse();

        SupportingDocumentJpaRepository documents = mock(SupportingDocumentJpaRepository.class);
        SupportingDocumentPersistenceMapper dMapper = new SupportingDocumentPersistenceMapper();
        SupportingDocumentPersistenceAdapter dAdapter = new SupportingDocumentPersistenceAdapter(documents, dMapper);
        SupportingDocument document = filled(new SupportingDocument());
        when(documents.save(any())).thenAnswer(inv -> inv.getArgument(0));
        assertThat(dAdapter.save(document).getStorageUri()).isEqualTo(document.getStorageUri());
        when(documents.findById(3L)).thenReturn(Optional.of(dMapper.toEntity(document)));
        assertThat(dAdapter.findById(3L)).isPresent();
        when(documents.findAll()).thenReturn(List.of());
        assertThat(dAdapter.findAll()).isEmpty();
        when(documents.findByJustificationId(1L)).thenReturn(List.of(dMapper.toEntity(document)));
        assertThat(dAdapter.findByJustificationId(1L)).hasSize(1);
        dAdapter.deleteById(3L);
        verify(documents).deleteById(3L);
        when(documents.existsById(3L)).thenReturn(true);
        assertThat(dAdapter.existsById(3L)).isTrue();
    }
}
