/** Tipos compartidos de paginación para los repositorios del dominio Quality. */

export interface ListPage {
  limit: number;
  offset: number;
}

/**
 * Resultado paginado. `total` es el número TOTAL de filas que cumplen el filtro
 * (no el de la página devuelta), igual que el `MemoryStore` al que sustituye.
 */
export interface PagedResult<T> {
  data: T[];
  total: number;
}
