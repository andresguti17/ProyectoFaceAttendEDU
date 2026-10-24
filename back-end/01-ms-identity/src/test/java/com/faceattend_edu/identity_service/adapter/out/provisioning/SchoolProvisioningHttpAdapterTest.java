package com.faceattend_edu.identity_service.adapter.out.provisioning;

import com.faceattend_edu.identity_service.application.port.in.OnboardSchoolUseCase;
import com.faceattend_edu.identity_service.config.OnboardingProperties;
import com.faceattend_edu.identity_service.domain.exception.DownstreamRejectedException;
import com.faceattend_edu.identity_service.domain.exception.DuplicateEntityException;
import com.faceattend_edu.identity_service.domain.exception.OnboardingUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseCreator;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.net.SocketTimeoutException;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Onboarding and account provisioning talk to academic and authorization. A call that
 * times out may still have gone through, so the adapter looks before giving up; a client
 * error keeps its status; anything else is 503; rollback deletes accept "already gone".
 */
@DisplayName("School and account provisioning over HTTP")
class SchoolProvisioningHttpAdapterTest {

    private static final String TOKEN = "token-1";
    private static final UUID PERSON = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private static final UUID USER = UUID.fromString("22222222-2222-4222-8222-222222222222");
    private static final String ROLES = "[{\"roleId\":1,\"roleName\":\"Super Administrador\"},{\"roleId\":3,\"roleName\":\"Administrador\"},{\"roleId\":2,\"roleName\":\"Instructor\"}]";
    private static final ResponseCreator TIMEOUT = request -> { throw new SocketTimeoutException("read timed out"); };

    private MockRestServiceServer server;
    private SchoolProvisioningHttpAdapter adapter;

    @BeforeEach
    void setUp() {
        OnboardingProperties properties = new OnboardingProperties();
        properties.setAcademicUrl("http://academic/");
        properties.setAuthorizationUrl("http://authorization");
        adapter = new SchoolProvisioningHttpAdapter(properties);
        RestTemplate rest = (RestTemplate) ReflectionTestUtils.getField(adapter, "restTemplate");
        server = MockRestServiceServer.bindTo(rest).build();
    }

    private void schools(String json) {
        server.expect(once(), requestTo("http://academic/api/v1/schools")).andExpect(method(HttpMethod.GET))
                .andExpect(header("Authorization", "Bearer " + TOKEN))
                .andRespond(withSuccess(json, MediaType.APPLICATION_JSON));
    }

    private void roles() {
        server.expect(once(), requestTo("http://authorization/api/v1/roles")).andRespond(withSuccess(ROLES, MediaType.APPLICATION_JSON));
    }

    private static OnboardSchoolUseCase.School school() {
        return new OnboardSchoolUseCase.School("S9", "Sede Nueva", " Bogotá ", null, " ", "sede@x.co");
    }

    @Test
    void findsASchoolByCodeIgnoringCase() {
        schools("[{\"schoolId\":4,\"code\":\"s9\"},{\"schoolId\":5,\"code\":\"S10\"}]");
        assertThat(adapter.findSchoolIdByCode(TOKEN, "S9")).isEqualTo(4L);
        server.verify();
        server.reset();
        schools("[]");
        assertThat(adapter.schoolCodeExists(TOKEN, "S9")).isFalse();
        server.verify();
    }

    @Test
    void createsTheSchoolInactiveWithOnlyTheGivenFields() {
        server.expect(requestTo("http://academic/api/v1/schools")).andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.status").value(false))
                .andExpect(jsonPath("$.cityName").value("Bogotá"))
                .andExpect(jsonPath("$.phone").doesNotExist())
                .andRespond(withSuccess("{\"schoolId\":12}", MediaType.APPLICATION_JSON));
        assertThat(adapter.createSchool(TOKEN, school())).isEqualTo(12L);
        server.verify();
    }

    @Test
    void aTakenCodeIsADuplicateAndOtherErrorsAre503() {
        server.expect(requestTo("http://academic/api/v1/schools")).andRespond(withStatus(HttpStatus.CONFLICT));
        assertThatThrownBy(() -> adapter.createSchool(TOKEN, school())).isInstanceOf(DuplicateEntityException.class);
        server.reset();
        server.expect(requestTo("http://academic/api/v1/schools")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> adapter.createSchool(TOKEN, school()))
                .isInstanceOf(OnboardingUnavailableException.class).hasMessageContaining("downstream status 502");
    }

    @Test
    void afterATimeoutTheSchoolThatWasCreatedAnywayIsReused() {
        server.expect(requestTo("http://academic/api/v1/schools")).andExpect(method(HttpMethod.POST)).andRespond(TIMEOUT);
        schools("[{\"schoolId\":12,\"code\":\"S9\"}]");
        assertThat(adapter.createSchool(TOKEN, school())).isEqualTo(12L);
        server.verify();

        server.reset();
        server.expect(requestTo("http://academic/api/v1/schools")).andExpect(method(HttpMethod.POST)).andRespond(TIMEOUT);
        schools("[]");
        assertThatThrownBy(() -> adapter.createSchool(TOKEN, school())).isInstanceOf(OnboardingUnavailableException.class).hasMessageContaining("no answer");
    }

    @Test
    void assignsTheAdministratorRoleRetryingOnceAndTreatingAlreadyAssignedAsDone() {
        roles();
        server.expect(requestTo("http://authorization/api/v1/users/" + USER + "/roles")).andExpect(jsonPath("$.roleId").value(3)).andRespond(TIMEOUT);
        server.expect(requestTo("http://authorization/api/v1/users/" + USER + "/roles")).andRespond(withStatus(HttpStatus.CONFLICT));
        adapter.assignAdminRole(TOKEN, USER);
        server.verify();

        server.reset();
        server.expect(requestTo("http://authorization/api/v1/roles")).andRespond(withSuccess("[{\"roleId\":2,\"roleName\":\"Instructor\"}]", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> adapter.assignAdminRole(TOKEN, USER)).hasMessage("Administrator role is not configured");

        server.reset();
        roles();
        server.expect(requestTo("http://authorization/api/v1/users/" + USER + "/roles")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        assertThatThrownBy(() -> adapter.assignAdminRole(TOKEN, USER)).isInstanceOf(OnboardingUnavailableException.class);
    }

    @Test
    void linksTheAdministratorAndRecoversTheActorAfterATimeout() {
        server.expect(requestTo("http://academic/api/v1/academic-actors")).andExpect(jsonPath("$.actorTypeId").value(3))
                .andRespond(withSuccess("{\"academicActorId\":30}", MediaType.APPLICATION_JSON));
        assertThat(adapter.linkAdminToSchool(TOKEN, PERSON, 12, "ADM-1")).isEqualTo(30L);
        server.verify();

        server.reset();
        server.expect(requestTo("http://academic/api/v1/academic-actors")).andRespond(TIMEOUT);
        server.expect(requestTo("http://academic/api/v1/academic-actors?personId=" + PERSON))
                .andRespond(withSuccess("[{\"academicActorId\":31}]", MediaType.APPLICATION_JSON));
        assertThat(adapter.linkAdminToSchool(TOKEN, PERSON, 12, "ADM-1")).isEqualTo(31L);

        server.reset();
        server.expect(requestTo("http://academic/api/v1/academic-actors")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertThatThrownBy(() -> adapter.linkAdminToSchool(TOKEN, PERSON, 12, "ADM-1")).isInstanceOf(OnboardingUnavailableException.class);
    }

    @Test
    void provisioningKeepsTheDownstreamClientErrorAndItsReason() {
        server.expect(requestTo("http://academic/api/v1/academic-actors")).andExpect(jsonPath("$.actorCode").value("E-1"))
                .andRespond(withSuccess("{\"academicActorId\":40}", MediaType.APPLICATION_JSON));
        assertThat(adapter.createActor(TOKEN, PERSON, 1, 12, " E-1 ")).isEqualTo(40L);

        server.reset();
        server.expect(requestTo("http://academic/api/v1/academic-actors"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).body("{\"message\":\"actorCode taken\"}").contentType(MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> adapter.createActor(TOKEN, PERSON, 1, 12, "E-1"))
                .isInstanceOfSatisfying(DownstreamRejectedException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(400);
                    assertThat(e.getMessage()).contains("actorCode taken");
                });

        server.reset();
        server.expect(requestTo("http://academic/api/v1/academic-actors")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> adapter.createActor(TOKEN, PERSON, 1, 12, "E-1"))
                .isInstanceOfSatisfying(DownstreamRejectedException.class, e -> assertThat(e.getMessage()).isEqualTo("Could not create the academic actor"));

        server.reset();
        server.expect(requestTo("http://academic/api/v1/academic-actors")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        assertThatThrownBy(() -> adapter.createActor(TOKEN, PERSON, 1, 12, "E-1")).isInstanceOf(OnboardingUnavailableException.class);

        server.reset();
        server.expect(requestTo("http://academic/api/v1/academic-actors")).andRespond(TIMEOUT);
        server.expect(requestTo("http://academic/api/v1/academic-actors?personId=" + PERSON)).andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> adapter.createActor(TOKEN, PERSON, 1, 12, "E-1")).hasMessageContaining("no answer");
    }

    @Test
    void enrollsAndAssignsRolesByName() {
        server.expect(requestTo("http://academic/api/v1/enrollments")).andExpect(jsonPath("$.enrollmentStatus").value("Active"))
                .andRespond(withSuccess("{\"enrollmentId\":50}", MediaType.APPLICATION_JSON));
        assertThat(adapter.createEnrollment(TOKEN, 40, 7)).isEqualTo(50L);
        server.reset();
        server.expect(requestTo("http://academic/api/v1/enrollments")).andRespond(withStatus(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> adapter.createEnrollment(TOKEN, 40, 7)).isInstanceOf(DownstreamRejectedException.class);
        server.reset();
        server.expect(requestTo("http://academic/api/v1/enrollments")).andRespond(TIMEOUT);
        assertThatThrownBy(() -> adapter.createEnrollment(TOKEN, 40, 7)).isInstanceOf(OnboardingUnavailableException.class);

        server.reset();
        roles();
        server.expect(requestTo("http://authorization/api/v1/users/" + USER + "/roles")).andExpect(jsonPath("$.roleId").value(2))
                .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        adapter.assignRole(TOKEN, USER, "instructor");
        server.verify();

        server.reset();
        roles();
        assertThatThrownBy(() -> adapter.assignRole(TOKEN, USER, "Coordinador")).hasMessage("Role Coordinador is not configured");

        server.reset();
        roles();
        server.expect(requestTo("http://authorization/api/v1/users/" + USER + "/roles")).andRespond(withStatus(HttpStatus.CONFLICT));
        adapter.assignRole(TOKEN, USER, "Instructor");
        server.verify();
    }

    @Test
    void rollbackDeletesTreatAlreadyGoneAsDone() {
        server.expect(requestTo("http://academic/api/v1/academic-actors/30")).andExpect(method(HttpMethod.DELETE)).andRespond(withStatus(HttpStatus.NOT_FOUND));
        server.expect(requestTo("http://academic/api/v1/enrollments/50")).andExpect(method(HttpMethod.DELETE)).andRespond(withSuccess());
        server.expect(requestTo("http://academic/api/v1/schools/12")).andExpect(method(HttpMethod.DELETE)).andRespond(TIMEOUT);
        server.expect(requestTo("http://academic/api/v1/schools/12")).andExpect(method(HttpMethod.DELETE)).andRespond(withSuccess());
        roles();
        server.expect(requestTo("http://authorization/api/v1/users/" + USER + "/roles/3")).andRespond(withSuccess());
        adapter.deleteActor(TOKEN, 30);
        adapter.deleteEnrollment(TOKEN, 50);
        adapter.deleteSchool(TOKEN, 12);
        adapter.removeAdminRole(TOKEN, USER);
        server.verify();

        server.reset();
        roles();
        server.expect(requestTo("http://authorization/api/v1/users/" + USER + "/roles/2")).andRespond(withStatus(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> adapter.removeRole(TOKEN, USER, "Instructor")).isInstanceOf(HttpClientErrorException.class);
        server.verify();
    }

    @Test
    void anUnexpectedAnswerIsAnOutageNotAZeroId() {
        server.expect(requestTo("http://academic/api/v1/enrollments")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> adapter.createEnrollment(TOKEN, 40, 7)).hasMessage("Unexpected response from downstream service");
        server.reset();
        server.expect(requestTo("http://academic/api/v1/academic-actors?personId=" + PERSON)).andRespond(withSuccess("[{\"academicActorId\":\"x\"},{\"academicActorId\":9}]", MediaType.APPLICATION_JSON));
        assertThat(adapter.findActorIdsByPerson(TOKEN, PERSON)).isEqualTo(List.of(9L));
    }
}
