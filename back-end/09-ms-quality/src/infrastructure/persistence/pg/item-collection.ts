import type { PoolClient } from 'pg';
import { runQuery, runQueryWith } from '../../db/database';

/**
 * Helper genérico para las colecciones hijas "código → valor" del dominio Quality:
 *   - `quality.quality_evaluation_item`     (subcaracterística ISO 25010 → Likert 1-5)
 *   - `quality.process_assessment_rating`   (objetivo ISO 29110 → N/P/L/F)
 *   - `quality.istqb_assessment_item`       (ítem ISTQB → Likert 1-5)
 *
 * Los identificadores (`table`, `*Column`, `*ArrayType`) son CONSTANTES de módulo
 * definidas por cada repositorio: nunca provienen de la entrada del usuario.
 * Los datos viajan siempre como parámetros `$n`.
 */
export interface ItemCollectionConfig {
  /** Tabla hija totalmente calificada, p.ej. `quality.quality_evaluation_item`. */
  table: string;
  /** Columna FK al agregado padre, p.ej. `evaluation_id`. */
  parentColumn: string;
  /** Columna con el código de catálogo, p.ej. `subcharacteristic_code`. */
  codeColumn: string;
  /** Columna con el valor, p.ej. `score`. */
  valueColumn: string;
  /** Cast SQL del array de códigos: siempre `varchar[]`. */
  codeArrayType: string;
  /** Cast SQL del array de valores, p.ej. `smallint[]` o `quality.objective_rating[]`. */
  valueArrayType: string;
}

interface ItemRow {
  parent_id: number;
  code: string;
  value: unknown;
}

/**
 * Sustituye la colección de ítems de un agregado:
 *  1. UPSERT de los ítems recibidos (resucita uno previamente borrado: `deleted_at = NULL`).
 *  2. Borrado LÓGICO de los ítems que ya no están (nunca `DELETE` físico — CONVENCIONES.md §2).
 *
 * El `UNIQUE (parent, code)` incluye filas borradas, por lo que la resurrección es segura
 * y no puede duplicar códigos.
 */
export async function writeItems(
  client: PoolClient,
  config: ItemCollectionConfig,
  parentId: number,
  entries: { codes: string[]; values: unknown[] },
): Promise<void> {
  await runQueryWith(
    client,
    `INSERT INTO ${config.table} (${config.parentColumn}, ${config.codeColumn}, ${config.valueColumn})
     SELECT $1::bigint, item_code, item_value
       FROM unnest($2::${config.codeArrayType}, $3::${config.valueArrayType}) AS t(item_code, item_value)
     ON CONFLICT (${config.parentColumn}, ${config.codeColumn})
     DO UPDATE SET ${config.valueColumn} = EXCLUDED.${config.valueColumn},
                   deleted_at = NULL,
                   deleted_by = NULL`,
    [parentId, entries.codes, entries.values],
  );

  await runQueryWith(
    client,
    `UPDATE ${config.table}
        SET deleted_at = CURRENT_TIMESTAMP
      WHERE ${config.parentColumn} = $1
        AND deleted_at IS NULL
        AND ${config.codeColumn} <> ALL($2::${config.codeArrayType})`,
    [parentId, entries.codes],
  );
}

/**
 * Carga las colecciones vivas (`deleted_at IS NULL`) de varios agregados de una sola vez,
 * evitando N+1 en los listados. Devuelve `Map<parentId, Record<code, valor crudo>>`.
 *
 * @param client conexión de una transacción abierta; sin él se usa el pool del proceso.
 */
export async function loadItems(
  config: ItemCollectionConfig,
  parentIds: readonly number[],
  client?: PoolClient,
): Promise<Map<number, Record<string, unknown>>> {
  const result = new Map<number, Record<string, unknown>>();
  if (!parentIds.length) return result;

  const sql = `SELECT ${config.parentColumn} AS parent_id,
                ${config.codeColumn}   AS code,
                ${config.valueColumn}  AS value
           FROM ${config.table}
          WHERE deleted_at IS NULL
            AND ${config.parentColumn} = ANY($1::bigint[])
          ORDER BY code ASC`;
  const rows = client ? await runQueryWith<ItemRow>(client, sql, [parentIds]) : await runQuery<ItemRow>(sql, [parentIds]);

  for (const row of rows) {
    const bucket = result.get(row.parent_id) ?? {};
    bucket[row.code] = row.value;
    result.set(row.parent_id, bucket);
  }
  return result;
}

/** Convierte los valores crudos de una colección en `Record<string, number>`. */
export function toNumberRecord(raw: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw ?? {})) out[key] = Number(value);
  return out;
}

/** Convierte los valores crudos de una colección en `Record<string, string>`. */
export function toStringRecord(raw: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) out[key] = String(value);
  return out;
}
