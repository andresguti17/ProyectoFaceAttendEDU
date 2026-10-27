package com.faceattend_edu.authorization_service.config;

import com.faceattend_edu.authorization_service.infrastructure.web.security.AuthTokenFilter;
import com.faceattend_edu.shared.auth.UserSchools;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class AppConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AuthTokenFilter authTokenFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health", "/api/v1/health", "/api/health",
                                 "/actuator/**", "/v3/api-docs/**", "/swagger-ui/**").permitAll()
                // Roles y evaluate ya no son públicos: AuthTokenFilter.filterPrimitive exige
                // sesión (y configuration:manage para consultar a otro usuario).
                .anyRequest().authenticated()
            )
            .addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** School membership of users, for scoping role changes by a school Administrador. */
    @Bean
    public UserSchools userSchools(@Value("${faceattend.auth.identity-url:http://localhost:8081}") String identityUrl,
                                   @Value("${faceattend.auth.academic-url:http://localhost:8083}") String academicUrl) {
        return new UserSchools(identityUrl, academicUrl);
    }
}
