/**
 * Ejecuta `work` sobre `items` en grupos de `size` en lugar de todo a la vez.
 *
 * Se usa para las cargas del historial y de justificaciones: ms-attendance
 * escanea la tabla de asistencia completa en cada petición y con el volumen
 * del seed (~81k registros) varias peticiones simultáneas agotan su heap
 * (OutOfMemoryError) y dejan el servicio sin responder.
 *
 * @param {Array} items Elementos a procesar.
 * @param {(item: any, index: number) => Promise<any>} work Tarea por elemento.
 * @param {number} size Peticiones simultáneas (por defecto 4).
 * @returns {Promise<Array>} Resultados en el mismo orden que `items`.
 */
export async function batched(items, work, size = 4) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
    }
    return out;
}
