package com.faceattend_edu.attendance_service.infrastructure.web.controller;

import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceGroupCount;
import com.faceattend_edu.attendance_service.infrastructure.persistence.repository.AttendanceRecordJpaRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AttendanceReportController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("IEEE 829 TC-05: Attendance Report HTTP Tests")
class AttendanceReportControllerTest {

    private static final String BASE = "/api/v1/attendance-reports";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AttendanceRecordJpaRepository recordRepository;

    /** Fila de la agregacion que devuelve el repositorio, sin Mockito. */
    private record GroupCount(Long classSessionId, Long academicActorId, String attendanceStatus, long total)
            implements AttendanceGroupCount {
        @Override
        public Long getClassSessionId() { return classSessionId; }

        @Override
        public Long getAcademicActorId() { return academicActorId; }

        @Override
        public String getAttendanceStatus() { return attendanceStatus; }

        @Override
        public long getTotal() { return total; }
    }

    private List<AttendanceGroupCount> sampleRows() {
        return List.of(
                new GroupCount(100L, 1L, "Present", 3),
                new GroupCount(100L, 1L, "Absent", 1),
                new GroupCount(100L, 2L, "Late", 2));
    }

    @Nested
    @DisplayName("TC-05-R01: Report request validation")
    class ValidationTests {

        @Test
        @DisplayName("Given no scope params when GET then 400 ISO-8.2-VAL-001 and no repository access")
        void givenNoScopeParams_whenGet_thenReturn400() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(get(BASE))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-001"))
                    .andExpect(jsonPath("$.error.message", containsString("Provide classSessionIds and/or academicActorIds")));
            verifyNoInteractions(recordRepository);
        }

        @Test
        @DisplayName("Given invalid format when GET then 400 ISO-8.2-VAL-001")
        void givenInvalidFormat_whenGet_thenReturn400() throws Exception {
            // Arrange

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("classSessionIds", "1").param("format", "xml"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-001"))
                    .andExpect(jsonPath("$.error.message", containsString("format must be json or csv")));
            verifyNoInteractions(recordRepository);
        }

        @Test
        @DisplayName("Given more than 1000 ids when GET then 400 ISO-8.2-VAL-001")
        void givenMoreThan1000Ids_whenGet_thenReturn400() throws Exception {
            // Arrange
            String tooMany = IntStream.rangeClosed(1, 1001)
                    .mapToObj(String::valueOf)
                    .collect(Collectors.joining(","));

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("classSessionIds", tooMany))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("ISO-8.2-VAL-001"))
                    .andExpect(jsonPath("$.error.message", containsString("at most 1000")));
            verifyNoInteractions(recordRepository);
        }
    }

    @Nested
    @DisplayName("TC-05-R02: JSON report")
    class JsonReportTests {

        @Test
        @DisplayName("Given grouped rows when GET json then 200 with real report keys and counts")
        void givenGroupedRows_whenGetJson_thenReturn200WithReportKeys() throws Exception {
            // Arrange
            when(recordRepository.countByGroups(eq(true), eq(Set.of(100L)), eq(false), eq(Set.of(-1L))))
                    .thenReturn(sampleRows());

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("classSessionIds", "100"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.generatedAt").exists())
                    .andExpect(jsonPath("$.filters.classSessionIds[0]").value(100))
                    .andExpect(jsonPath("$.filters.academicActorIds").isEmpty())
                    .andExpect(jsonPath("$.rateDefinition")
                            .value("attendanceRate = (present + late) / total * 100"))
                    .andExpect(jsonPath("$.totals.present").value(3))
                    .andExpect(jsonPath("$.totals.late").value(2))
                    .andExpect(jsonPath("$.totals.absent").value(1))
                    .andExpect(jsonPath("$.totals.justified").value(0))
                    .andExpect(jsonPath("$.totals.total").value(6))
                    .andExpect(jsonPath("$.totals.attendanceRate").value(83.3))
                    .andExpect(jsonPath("$.byActor[0].academicActorId").value(1))
                    .andExpect(jsonPath("$.byActor[0].counts.present").value(3))
                    .andExpect(jsonPath("$.byActor[0].counts.absent").value(1))
                    .andExpect(jsonPath("$.byActor[1].academicActorId").value(2))
                    .andExpect(jsonPath("$.bySession[0].classSessionId").value(100))
                    .andExpect(jsonPath("$.bySession[0].counts.total").value(6));
            verify(recordRepository).countByGroups(eq(true), eq(Set.of(100L)), eq(false), eq(Set.of(-1L)));
        }

        @Test
        @DisplayName("Given session and actor filters when GET json then both flags passed true")
        void givenSessionAndActorFilters_whenGetJson_thenReturn200WithBothFlags() throws Exception {
            // Arrange
            when(recordRepository.countByGroups(eq(true), eq(Set.of(100L)), eq(true), eq(Set.of(1L, 2L))))
                    .thenReturn(sampleRows());

            // Act
            // Assert
            mockMvc.perform(get(BASE)
                            .param("classSessionIds", "100")
                            .param("academicActorIds", "1,2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.filters.classSessionIds[0]").value(100))
                    .andExpect(jsonPath("$.filters.academicActorIds[0]").value(1))
                    .andExpect(jsonPath("$.filters.academicActorIds[1]").value(2));
            verify(recordRepository).countByGroups(eq(true), eq(Set.of(100L)), eq(true), eq(Set.of(1L, 2L)));
        }
    }

    @Nested
    @DisplayName("TC-05-R03: CSV report")
    class CsvReportTests {

        @Test
        @DisplayName("Given grouped rows when GET csv then 200 with attachment and CSV body")
        void givenGroupedRows_whenGetCsv_thenReturn200WithCsvAttachment() throws Exception {
            // Arrange
            when(recordRepository.countByGroups(eq(true), eq(Set.of(100L)), eq(false), eq(Set.of(-1L))))
                    .thenReturn(sampleRows());

            // Act
            // Assert
            mockMvc.perform(get(BASE).param("classSessionIds", "100").param("format", "csv"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Disposition",
                            "attachment; filename=\"attendance-report.csv\""))
                    .andExpect(content().contentTypeCompatibleWith("text/csv"))
                    .andExpect(content().string(containsString(
                            "scope,id,present,late,absent,justified,total,attendanceRate")))
                    .andExpect(content().string(containsString("TOTAL,,3,2,1,0,6,83.3")))
                    .andExpect(content().string(containsString("ACTOR,1,3,0,1,0,4,75.0")))
                    .andExpect(content().string(containsString("ACTOR,2,0,2,0,0,2,100.0")))
                    .andExpect(content().string(containsString("SESSION,100,3,2,1,0,6,83.3")));
        }
    }
}
