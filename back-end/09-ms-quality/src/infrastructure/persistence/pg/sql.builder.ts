/**
 * Construcción de fragmentos SQL parametrizados.
 *
 * Regla de seguridad (OWASP A03 / fae-docs/00-governance/security-rules.md):
 * los nombres de columna proceden SIEMPRE de constantes de módulo (listas blancas),
 * nunca del payload del cliente; todos los valores viajan como placeholders `$n`.
 * No hay concatenación de entrada de usuario en ningún punto.
 *
 * Funciones puras: unit-testeables sin base de datos.
 */

export interface SetClause {
  /** Fragmento `col_a = $2, col_b = $3` (cadena vacía si el patch no aporta columnas). */
  sql: string;
  /** Valores en el mismo orden que los placeholders generados. */
  values: unknown[];
}

export interface FilterClause {
  /** Fragmento ` AND col_a = $1 AND col_b = $2` (cadena vacía si no hay filtros activos). */
  sql: string;
  values: unknown[];
}

export interface FilterCondition {
  /** Nombre físico de la columna (constante del repositorio). */
  column: string;
  /** Valor a comparar; `undefined`/`null`/`''` desactiva el filtro. */
  value: unknown;
}

/**
 * Construye el `SET` de un UPDATE a partir de una lista blanca campo→columna.
 * Itera `columns` (no el patch) para que el SQL generado sea determinista y
 * cacheable por PostgreSQL, y omite claves ausentes o `undefined`.
 *
 * @param firstParamIndex índice del primer placeholder libre (`$1` suele ser el id).
 */
export function buildSetClause<F extends string>(
  columns: Readonly<Record<F, string>>,
  patch: Partial<Record<F, unknown>>,
  firstParamIndex = 2,
): SetClause {
  const assignments: string[] = [];
  const values: unknown[] = [];
  let index = firstParamIndex;
  for (const field of Object.keys(columns) as F[]) {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) continue;
    const value = patch[field];
    if (value === undefined) continue;
    assignments.push(`${columns[field]} = $${index}`);
    values.push(value);
    index += 1;
  }
  return { sql: assignments.join(', '), values };
}

/**
 * Construye un fragmento `AND ...` para filtros opcionales de listado.
 * Se pensó para concatenarse después de un predicado fijo (`WHERE deleted_at IS NULL`).
 */
export function buildAndFilters(conditions: readonly FilterCondition[], startIndex = 1): FilterClause {
  const parts: string[] = [];
  const values: unknown[] = [];
  let index = startIndex;
  for (const condition of conditions) {
    const { value } = condition;
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${condition.column} = $${index}`);
    values.push(value);
    index += 1;
  }
  return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', values };
}

/**
 * Placeholder `INSERT ... SELECT ... FROM unnest($a::k[], $b::v[])` para volcar un
 * `Record<string, number|string>` en una tabla hija sin SQL dinámico.
 * Devuelve los dos arrays alineados (mismas claves, mismo orden).
 */
export function recordToArrays<T>(record: Readonly<Record<string, T>>): { codes: string[]; values: T[] } {
  const codes = Object.keys(record);
  return { codes, values: codes.map((code) => record[code]) };
}
