package com.faceattend_edu.identity_service.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Ciclo de vida de la sesión opaca: start/end, isActive, isExpired contra el
 * timeout configurado y durationSeconds.
 */
@DisplayName("UserSession domain model tests")
class UserSessionTest {

    private UserSession runningSession() {
        UserSession session = new UserSession();
        session.start();
        return session;
    }

    @Test
    @DisplayName("start_activatesTheSessionAndClearsEndDate")
    void start_activatesTheSessionAndClearsEndDate() {
        UserSession session = new UserSession();
        session.setEndDate(LocalDateTime.now());

        session.start();

        assertEquals(UserSession.STATUS_ACTIVE, session.getSessionStatus());
        assertNotNull(session.getStartDate());
        assertNull(session.getEndDate());
        assertTrue(session.isActive());
    }

    @Test
    @DisplayName("end_closesTheSession")
    void end_closesTheSession() {
        UserSession session = runningSession();

        session.end();

        assertEquals(UserSession.STATUS_CLOSED, session.getSessionStatus());
        assertNotNull(session.getEndDate());
        assertFalse(session.isActive());
    }

    @Test
    @DisplayName("isActive_isTrueOnlyForActiveSessionsWithoutEndDate")
    void isActive_isTrueOnlyForActiveSessionsWithoutEndDate() {
        UserSession active = runningSession();
        assertTrue(active.isActive());

        // Status Active pero con endDate ya fijado: no está activa.
        UserSession inconsistent = runningSession();
        inconsistent.setEndDate(LocalDateTime.now());
        assertFalse(inconsistent.isActive());

        UserSession closed = runningSession();
        closed.end();
        assertFalse(closed.isActive());

        assertFalse(new UserSession().isActive());
    }

    @Test
    @DisplayName("isExpired_neverExpiresWithoutUsableTimeout")
    void isExpired_neverExpiresWithoutUsableTimeout() {
        UserSession session = runningSession();

        assertFalse(session.isExpired(null));
        assertFalse(session.isExpired(Duration.ZERO));
        assertFalse(session.isExpired(Duration.ofSeconds(-5)));
    }

    @Test
    @DisplayName("isExpires_whenTimeoutIsShorterThanElapsedTime")
    void isExpires_whenTimeoutIsShorterThanElapsedTime() {
        UserSession session = runningSession();
        session.setStartDate(LocalDateTime.now().minusMinutes(10));

        assertTrue(session.isExpired(Duration.ofMinutes(5)));
        assertFalse(session.isExpired(Duration.ofMinutes(30)));
    }

    @Test
    @DisplayName("isExpired_isFalseForClosedSessionsEvenWithTimeout")
    void isExpired_isFalseForClosedSessionsEvenWithTimeout() {
        UserSession closed = runningSession();
        closed.setStartDate(LocalDateTime.now().minusHours(9));
        closed.end();

        assertFalse(closed.isExpired(Duration.ofMinutes(5)));
    }

    @Test
    @DisplayName("isExpired_activeSessionWithoutStartDateCountsAsExpired")
    void isExpired_activeSessionWithoutStartDateCountsAsExpired() {
        // Rama real del código: una sesión Active sin startDate no es confiable.
        UserSession session = new UserSession();
        session.setSessionStatus(UserSession.STATUS_ACTIVE);

        assertTrue(session.isExpired(Duration.ofMinutes(5)));
    }

    @Test
    @DisplayName("durationSeconds_measuresBetweenStartAndEnd")
    void durationSeconds_measuresBetweenStartAndEnd() {
        UserSession session = new UserSession();
        session.setStartDate(LocalDateTime.now().minusSeconds(90));
        session.setEndDate(LocalDateTime.now());

        assertEquals(90L, session.durationSeconds());
    }

    @Test
    @DisplayName("durationSeconds_isZeroWithoutStartDate")
    void durationSeconds_isZeroWithoutStartDate() {
        assertEquals(0L, new UserSession().durationSeconds());
    }

    @Test
    @DisplayName("durationSeconds_isNeverNegativeForRunningSessions")
    void durationSeconds_isNeverNegativeForRunningSessions() {
        // En curso: mide hasta "ahora".
        UserSession running = runningSession();
        assertTrue(running.durationSeconds() >= 0L);

        // endDate anterior a startDate: nunca devuelve negativo.
        UserSession reversed = new UserSession();
        reversed.setStartDate(LocalDateTime.now());
        reversed.setEndDate(LocalDateTime.now().minusMinutes(5));
        assertEquals(0L, reversed.durationSeconds());
    }
}
