package com.faceattend_edu.attendance_service.config;

import com.faceattend_edu.attendance_service.infrastructure.web.security.AuthTokenFilter;
import com.faceattend_edu.shared.auth.DocsAccess;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class AppConfig {
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, AuthTokenFilter authTokenFilter,
                                                   @Value("${springdoc.api-docs.enabled:true}") boolean docsEnabled) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/health", "/api/v1/health", "/api/health",
                                 "/actuator/health", "/actuator/health/**").permitAll()
                // The API docs are open only while springdoc is enabled (development; production
                // sets SPRINGDOC_API_DOCS_ENABLED=false). Disabled, they get the 403 of any unknown
                // path instead of reaching a handler that answers 500 for a missing resource.
                .requestMatchers(DocsAccess.matcher(docsEnabled)).permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(authTokenFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
