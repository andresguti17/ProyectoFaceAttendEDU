package com.faceattend_edu.identity_service.config;

import com.faceattend_edu.identity_service.adapter.in.web.security.AuthTokenFilter;
import com.faceattend_edu.shared.auth.DocsAccess;
import org.springframework.beans.factory.annotation.Value;
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
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AuthTokenFilter authTokenFilter,
                                                   @Value("${springdoc.api-docs.enabled:true}") boolean docsEnabled) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health", "/api/v1/health", "/api/health",
                                 "/actuator/health", "/actuator/health/**").permitAll()
                // The API docs are open only while springdoc is enabled (development; production
                // sets SPRINGDOC_API_DOCS_ENABLED=false). Disabled, they get the 403 of any unknown
                // path instead of reaching a handler that answers 500 for a missing resource.
                .requestMatchers(DocsAccess.matcher(docsEnabled)).permitAll()
                // Bootstrap público (igual que AuthTokenFilter.isPublic): sin sesión
                // no hay Authentication y anyRequest().authenticated() devolvería 403.
                .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/login/verify", "/api/v1/auth/logout",
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
