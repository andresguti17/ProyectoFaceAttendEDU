package com.faceattend_edu.attendance_service.infrastructure.web;

import org.springframework.http.ResponseEntity;

import java.util.List;

/**
 * Recorte de colecciones por limit/offset, con el mismo contrato que ms-academic
 * y ms-scheduling: sin parámetros devuelve la lista entera, con ellos devuelve
 * el tramo y añade X-Total-Count. Sin esto los clientes móviles descargaban la
 * tabla completa en cada pantalla y la petición no terminaba en el dispositivo.
 */
public final class Paging {

    public static final int MAX_LIMIT = 100;

    private Paging() {
    }

    public static <T> ResponseEntity<List<T>> slice(List<T> items, Integer limit, Integer offset) {
        if (limit == null && offset == null) return ResponseEntity.ok(items);

        int safeLimit = limitOf(limit);
        int safeOffset = offsetOf(offset);
        int from = Math.min(safeOffset, items.size());
        int to = Math.min(from + safeLimit, items.size());

        return ResponseEntity.ok()
                .header("X-Total-Count", String.valueOf(items.size()))
                .body(List.copyOf(items.subList(from, to)));
    }

    public static int limitOf(Integer limit) {
        return limit == null ? MAX_LIMIT : Math.min(Math.max(limit, 1), MAX_LIMIT);
    }

    public static int offsetOf(Integer offset) {
        return offset == null ? 0 : Math.max(offset, 0);
    }
}
