package com.faceattend_edu.identity_service.config;

import com.faceattend_edu.identity_service.adapter.in.web.security.AuthTokenFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // ADR-008: bcrypt cost 12, $2b$ hash format.
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(BCryptPasswordEncoder.BCryptVersion.$2B, 12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AuthTokenFilter authTokenFilter) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health", "/api/v1/health", "/api/health",
                                 "/actuator/**", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                // Bootstrap público (igual que AuthTokenFilter.isPublic): sin sesión
                // no hay Authentication y anyRequest().authenticated() devolvería 403.
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/logout",
                                 "/api/v1/auth/refresh", "/api/v1/auth/forgot-password",
                                 "/api/v1/auth/verify-code", "/api/v1/auth/reset-password").permitAll()
                // Lectura de sesión por UUID (ver AuthTokenFilter.isPublic): rompe la
                // recursión de validación entre microservicios. Solo un segmento: /sessions/user/{id}
                // lista sesiones ajenas y sigue exigiendo autenticación.
                .requestMatchers(HttpMethod.GET, "/api/v1/sessions/*").permitAll()
                // Alta pública de sede + administrador (queda pendiente de activación).
                .requestMatchers(HttpMethod.POST, "/api/v1/onboarding/schools").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
