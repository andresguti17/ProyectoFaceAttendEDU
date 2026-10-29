package com.faceattend_edu.identity_service.adapter.in.web;

import com.faceattend_edu.identity_service.config.AuthProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * The web session cookie (finding S-10): the browser keeps the session id in an HttpOnly cookie, so a script
 * injected in the page cannot read it. Only clients that ask for it with {@code X-Session-Mode: cookie} (the web)
 * get it; the mobile app and the scripts keep receiving the id in the response body and sending it as a Bearer.
 *
 * <p>The cookie lives as long as the session ({@code start_date + session timeout}), is only sent to
 * {@code /api/v1} and is never set for a Domain, so it stays tied to the host that issued it.</p>
 */
@Component
public class SessionCookie {

    public static final String MODE_HEADER = "X-Session-Mode";
    private static final String COOKIE_MODE = "cookie";

    private final AuthProperties authProperties;
    private final String name;
    private final boolean secure;
    private final String sameSite;
    private final String path;

    public SessionCookie(AuthProperties authProperties,
                         @Value("${faceattend.session.cookie.name:fae_session}") String name,
                         @Value("${faceattend.session.cookie.secure:true}") boolean secure,
                         @Value("${faceattend.session.cookie.same-site:Lax}") String sameSite,
                         @Value("${faceattend.session.cookie.path:/api/v1}") String path) {
        this.authProperties = authProperties;
        this.name = name;
        this.secure = secure;
        this.sameSite = sameSite;
        this.path = path;
    }

    /** The client asked to keep the session in the cookie instead of the response body. */
    public boolean requested(HttpServletRequest request) {
        return COOKIE_MODE.equalsIgnoreCase(request.getHeader(MODE_HEADER));
    }

    /** The cookie that carries the session, valid for as long as the session is. */
    public ResponseCookie issue(UUID sessionId) {
        return base(sessionId.toString()).maxAge(authProperties.sessionTimeout()).build();
    }

    /** Same cookie name and path with no value and no life: the browser drops it. */
    public ResponseCookie clear() {
        return base("").maxAge(0).build();
    }

    /** The session id in the cookie, if the request has one and it is a UUID. */
    public Optional<UUID> read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return Optional.empty();
        for (Cookie cookie : cookies) {
            if (!name.equals(cookie.getName())) continue;
            try {
                return Optional.of(UUID.fromString(cookie.getValue()));
            } catch (IllegalArgumentException e) {
                return Optional.empty();
            }
        }
        return Optional.empty();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(name, value).httpOnly(true).secure(secure).sameSite(sameSite).path(path);
    }
}
