package com.faceattend_edu.attendance_service.infrastructure.web.security;

import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/** Bearer token of the request in progress (set by AuthTokenFilter), to call other services on the caller's behalf. */
public final class CallerToken {

    public static final String ATTRIBUTE = "attendance.callerToken";

    private CallerToken() {}

    /** The caller's token, or {@code null} outside a request. */
    public static String current() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        Object token = attributes == null ? null : attributes.getAttribute(ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        return token instanceof String s ? s : null;
    }
}
