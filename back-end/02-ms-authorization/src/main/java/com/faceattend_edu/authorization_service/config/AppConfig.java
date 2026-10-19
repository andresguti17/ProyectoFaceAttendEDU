package com.faceattend_edu.authorization_service.config;

import com.faceattend_edu.authorization_service.infrastructure.web.security.AuthTokenFilter;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
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
                // Primitivas de lectura del propio filtro (ver AuthTokenFilter.isPublic):
                // rompen la recursión de validación entre microservicios.
                .requestMatchers(HttpMethod.GET, "/api/v1/auth/evaluate", "/auth/evaluate",
                                 "/api/v1/users/*/roles", "/users/*/roles").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
