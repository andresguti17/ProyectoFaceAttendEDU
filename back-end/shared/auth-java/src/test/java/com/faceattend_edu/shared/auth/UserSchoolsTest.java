package com.faceattend_edu.shared.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class UserSchoolsTest {

    private static final String TOKEN = "11111111-2222-3333-4444-555555555555";
    private static final String USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    private static final String PERSON = "pppppppp-0000-4000-8000-000000000001";
    private static final String USER_URL = "http://identity/api/v1/users/" + USER;
    private static final String ACTORS_URL = "http://academic/api/v1/academic-actors?personId=" + PERSON;

    private MockRestServiceServer server;
    private UserSchools schools;

    @BeforeEach
    void setUp() {
        RestTemplate rest = new RestTemplate();
        server = MockRestServiceServer.bindTo(rest).build();
        schools = new UserSchools(rest, "http://identity", "http://academic");
    }

    @Test
    void schoolsComeFromThePersonsOwnActorsWithTheCallersToken() {
        server.expect(requestTo(USER_URL)).andExpect(header("Authorization", "Bearer " + TOKEN))
                .andRespond(withSuccess("{\"personId\":\"" + PERSON + "\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(ACTORS_URL)).andExpect(header("Authorization", "Bearer " + TOKEN))
                .andRespond(withSuccess("[{\"personId\":\"" + PERSON + "\",\"schoolId\":7},"
                        + "{\"personId\":\"someone-else\",\"schoolId\":9}]", MediaType.APPLICATION_JSON));

        assertThat(schools.of(USER, TOKEN)).containsExactly(7);
        server.verify();
    }

    @Test
    void aUserOutsideTheCallersScopeHasNoVisibleSchool() {
        server.expect(requestTo(USER_URL)).andRespond(withStatus(HttpStatus.FORBIDDEN));
        assertThat(schools.of(USER, TOKEN)).isEmpty();
        server.verify();
    }

    @Test
    void aUserWithoutPersonHasNoSchool() {
        server.expect(requestTo(USER_URL)).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        assertThat(schools.of(USER, TOKEN)).isEmpty();
        server.verify();
    }

    @Test
    void anUnreachableServiceFailsInsteadOfAllowing() {
        server.expect(requestTo(USER_URL)).andRespond(withException(new IOException("down")));
        assertThatThrownBy(() -> schools.of(USER, TOKEN)).isInstanceOf(ResourceAccessException.class);
    }
}
