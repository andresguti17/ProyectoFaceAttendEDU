package com.faceattend_edu.identity_service.adapter.in.web.dto;

import java.util.List;

/**
 * Envelope for collection responses, as mandated by
 * fae-docs/07-api/contracts/openapi/_shared.yaml (PaginatedMeta).
 */
public record PageResponse<T>(List<T> data, Meta meta) {

    public record Meta(int page, int limit, long total, int totalPages) {
    }

    public static final int MAX_LIMIT = 100;
    public static final int DEFAULT_LIMIT = 20;

    public static int safeLimit(Integer limit) {
        return limit == null ? DEFAULT_LIMIT : Math.min(Math.max(limit, 1), MAX_LIMIT);
    }

    public static int safePage(Integer page) {
        return page == null ? 1 : Math.max(page, 1);
    }

    /**
     * Wraps a page that the database already sliced. Prefer this over {@link #of}: it never
     * needs the rows outside the page, so the query stays proportional to the page size.
     */
    public static <T> PageResponse<T> ofSlice(List<T> pageItems, Integer page, Integer limit, long total) {
        int safeLimit = safeLimit(limit);
        int totalPages = (int) Math.ceil(total / (double) safeLimit);
        return new PageResponse<>(pageItems == null ? List.of() : List.copyOf(pageItems),
                new Meta(safePage(page), safeLimit, total, totalPages));
    }

    /** In-memory slicing, for collections small enough to load whole. */
    public static <T> PageResponse<T> of(List<T> items, Integer page, Integer limit) {
        List<T> all = items == null ? List.of() : items;
        int safeLimit = safeLimit(limit);
        int safePage = safePage(page);
        int total = all.size();
        int from = Math.min((safePage - 1) * safeLimit, total);
        int to = Math.min(from + safeLimit, total);
        int totalPages = (int) Math.ceil(total / (double) safeLimit);
        return new PageResponse<>(List.copyOf(all.subList(from, to)),
                new Meta(safePage, safeLimit, total, totalPages));
    }
}
