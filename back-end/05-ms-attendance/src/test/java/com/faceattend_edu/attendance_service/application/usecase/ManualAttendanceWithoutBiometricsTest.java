package com.faceattend_edu.attendance_service.application.usecase;

import com.faceattend_edu.attendance_service.domain.model.ArrivalWindow;
import com.faceattend_edu.attendance_service.domain.model.AttendanceRecord;
import com.faceattend_edu.attendance_service.domain.port.out.ArrivalWindowPort;
import com.faceattend_edu.attendance_service.domain.port.out.AttendanceRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/**
 * Ley 1581, art. 6: autorizar el tratamiento biométrico es facultativo. Quien no tiene rostro ni huella
 * inscritos asiste por la vía MANUAL, sin puntaje de coincidencia, y su asistencia se registra igual que la
 * de los demás (L-NEW-01). El caso de uso solo depende del repositorio de asistencia: no consulta ni exige
 * datos biométricos.
 */
@ExtendWith(MockitoExtension.class)
class ManualAttendanceWithoutBiometricsTest {

    private static final long SESSION = 10L;
    private static final long ACTOR_WITHOUT_BIOMETRICS = 77L;

    @Mock AttendanceRecordRepository repository;

    private RecordAttendanceUseCaseImpl record;

    private static final ZoneId BOGOTA = ZoneId.of("America/Bogota");

    private static ArrivalWindowPort classStarted(long minutesAgo) {
        return id -> new ArrivalWindow(LocalDateTime.now(BOGOTA).minusMinutes(minutesAgo), 15, BOGOTA);
    }

    @BeforeEach
    void setUp() {
        record = new RecordAttendanceUseCaseImpl(repository, classStarted(0));
        when(repository.findByClassSessionIdAndAcademicActorId(SESSION, ACTOR_WITHOUT_BIOMETRICS)).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void aManualPresenceWithoutAMatchScoreIsRecordedAsPresent() {
        AttendanceRecord saved = record.record(SESSION, ACTOR_WITHOUT_BIOMETRICS, "Present", "MANUAL", null);

        assertEquals("Present", saved.getAttendanceStatus());
        assertEquals("MANUAL", saved.getCaptureMethod());
        assertNull(saved.getMatchScore());
        assertNotNull(saved.getCapturedAt());
    }

    @Test
    void aManualLateArrivalIsRecordedAsLate() {
        record = new RecordAttendanceUseCaseImpl(repository, classStarted(40));
        AttendanceRecord saved = record.record(SESSION, ACTOR_WITHOUT_BIOMETRICS, "Present", "MANUAL", null);

        assertEquals("Late", saved.getAttendanceStatus());
        assertNotNull(saved.getCapturedAt());
    }

    @Test
    void theOnlyDataTheUseCaseTouchesIsTheAttendanceRepository() {
        record.record(SESSION, ACTOR_WITHOUT_BIOMETRICS, "Present", "MANUAL", null);

        // Sin llamadas a otros colaboradores: no hay puerto biométrico del que dependa el registro.
        verifyNoMoreInteractions(repository);
    }
}
