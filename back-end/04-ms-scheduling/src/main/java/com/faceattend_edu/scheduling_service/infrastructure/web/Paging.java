package com.faceattend_edu.scheduling_service.infrastructure.web;

import org.springframework.http.ResponseEntity;

import java.util.List;

/**
 * Recorte de colecciones por limit/offset, con el mismo contrato que ms-academic:
 * sin parámetros devuelve la lista entera, con ellos devuelve el tramo y añade
 * X-Total-Count. Antes estos endpoints ignoraban la paginación y respondían la
 * tabla completa en cada página, así que un cliente que recorría páginas recibía
 * la misma lista una y otra vez.
 */
public final class Paging {

    public static final int MAX_LIMIT = 100;

    private Paging() {
    }

    public static <T> ResponseEntity<List<T>> slice(List<T> items, Integer limit, Integer offset) {
        if (limit == null && offset == null) return ResponseEntity.ok(items);

        int safeLimit = limit == null ? MAX_LIMIT : Math.min(Math.max(limit, 1), MAX_LIMIT);
        int safeOffset = offset == null ? 0 : Math.max(offset, 0);
        int from = Math.min(safeOffset, items.size());
        int to = Math.min(from + safeLimit, items.size());

        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(items.size()))
                .body(List.copyOf(items.subList(from, to)));
    }
}
