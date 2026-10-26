'use strict';

/**
 * Generic PostgreSQL CRUD adapter shared by the Node services.
 *
 * Holds every statement the concrete repositories issue, so the SQL lives in one
 * audited place and each aggregate adapter only declares its table, its column map
 * and its row->JSON projection.
 *
 * Injection safety (OWASP A03):
 *   - values always travel as bind parameters ($1, $2, ...);
 *   - identifiers (table, columns, ORDER BY, scoped subqueries) come only from the
 *     static declarations in code; nothing from a request is concatenated into SQL.
 *
 * Audit columns are read-only (writable: false): the fn_audit_timestamps() trigger
 * owns them. Every read filters deleted_at IS NULL; softDelete() never DELETEs.
 */

const { RepositoryError, translateDbError } = require('./errors');

/**
 * Builds the base class bound to one service's database module. `db.runQuery` and
 * `db.runCommand` are looked up on every call, so a test that mocks the service's
 * database module still intercepts the SQL.
 * @param {{ runQuery: Function, runCommand: Function }} db
 */
function definePostgresCrudRepository(db) {
  class PostgresCrudRepository {
    constructor() {
      /** Optional cast for the primary key bind parameter. */
      this.primaryKeyCast = undefined;
    }

    get selectColumns() {
      return this.fields.map((f) => f.column).join(', ');
    }

    /** Resolves a JSON field to its whitelisted column; nothing else may become an identifier. */
    columnOf(field) {
      const spec = this.fields.find((f) => f.field === field);
      if (!spec) throw new Error(`${this.qualifiedTable}: unmapped field '${field}'`);
      return spec.column;
    }

    /** Cast declared for a JSON field, if the column is a native enum. */
    castOf(field) {
      return this.fields.find((f) => f.field === field)?.cast;
    }

    get orderByClause() {
      return `${this.primaryKeyColumn} ASC`;
    }

    pkPlaceholder(index) {
      return `$${index}${this.primaryKeyCast ? `::${this.primaryKeyCast}` : ''}`;
    }

    buildFilters(filters, startIndex) {
      const params = [];
      if (!filters || filters.length === 0) return { clause: '', params };
      let index = startIndex;
      const parts = filters.map((filter) => {
        // Defence in depth: every column used as an identifier must be whitelisted,
        // even though filters are only built through filterOn().
        if (!this.fields.some((f) => f.column === filter.column)) {
          throw new RepositoryError(500, 'InternalError', `Unmapped filter column for ${this.qualifiedTable}`);
        }
        params.push(filter.value);
        if (filter.op === 'in') {
          // Array bind: `$n::type[]` compared with `= ANY(...)`.
          const arrayCast = filter.cast ? `::${filter.cast}[]` : '';
          return `${filter.column} = ANY($${index++}${arrayCast})`;
        }
        const cast = filter.cast ? `::${filter.cast}` : '';
        return `${filter.column} = $${index++}${cast}`;
      });
      return { clause: ` AND ${parts.join(' AND ')}`, params };
    }

    /** Builds a filter from a whitelisted JSON field name, carrying its enum cast. */
    filterOn(field, value) {
      return { column: this.columnOf(field), value, cast: this.castOf(field) };
    }

    mapRow(row) {
      const out = {};
      for (const f of this.fields) {
        const raw = row[f.column];
        out[f.field] = f.fromRow ? f.fromRow(raw) : (raw ?? null);
      }
      return out;
    }

    async select(sql, params) {
      try {
        return await db.runQuery(sql, params);
      } catch (err) {
        throw translateDbError(err, this.qualifiedTable);
      }
    }

    async execute(sql, params) {
      try {
        return await db.runCommand(sql, params);
      } catch (err) {
        throw translateDbError(err, this.qualifiedTable);
      }
    }

    // ── Reads ──────────────────────────────────────────────────────────────

    async list(query = {}) {
      const { clause, params } = this.buildFilters(query.filters, 1);
      let sql = `SELECT ${this.selectColumns} FROM ${this.qualifiedTable} WHERE deleted_at IS NULL${clause} ORDER BY ${this.orderByClause}`;
      return this.paged(sql, params, query);
    }

    /** Total matching rows, ignoring LIMIT/OFFSET: backs the x-total-count header. */
    async count(query = {}) {
      const { clause, params } = this.buildFilters(query.filters, 1);
      const rows = await this.select(
        `SELECT COUNT(*)::int AS total FROM ${this.qualifiedTable} WHERE deleted_at IS NULL${clause}`,
        params,
      );
      return Number(rows[0]?.total ?? 0);
    }

    async findById(id) {
      const rows = await this.select(
        `SELECT ${this.selectColumns} FROM ${this.qualifiedTable} WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(1)} AND deleted_at IS NULL`,
        [id],
      );
      return rows.length > 0 ? this.mapRow(rows[0]) : null;
    }

    async existsById(id) {
      const rows = await this.select(
        `SELECT EXISTS(SELECT 1 FROM ${this.qualifiedTable} WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(1)} AND deleted_at IS NULL) AS found`,
        [id],
      );
      return rows[0]?.found === true;
    }

    // ── Writes ─────────────────────────────────────────────────────────────

    /** INSERT ... RETURNING of the whitelisted, writable fields present in `input`. */
    async create(input) {
      const columns = [];
      const placeholders = [];
      const params = [];
      for (const f of this.fields) {
        if (f.writable === false) continue;
        if (!(f.field in input) || input[f.field] === undefined) continue;
        columns.push(f.column);
        params.push(f.toParam ? f.toParam(input[f.field]) : input[f.field]);
        placeholders.push(`$${params.length}${f.cast ? `::${f.cast}` : ''}`);
      }
      if (columns.length === 0) {
        throw new RepositoryError(400, 'BadRequest', `No writable fields supplied for ${this.qualifiedTable}`);
      }
      const rows = await this.select(
        `INSERT INTO ${this.qualifiedTable} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${this.selectColumns}`,
        params,
      );
      return this.mapRow(rows[0]);
    }

    /**
     * Partial UPDATE ... RETURNING of a live row; null when it does not exist. An empty
     * patch is a plain read: no statement moves an audit column.
     */
    async update(id, patch) {
      const sets = [];
      const params = [];
      for (const f of this.fields) {
        if (f.writable === false) continue;
        if (!(f.field in patch) || patch[f.field] === undefined) continue;
        params.push(f.toParam ? f.toParam(patch[f.field]) : patch[f.field]);
        sets.push(`${f.column} = $${params.length}${f.cast ? `::${f.cast}` : ''}`);
      }
      params.push(id);
      const where = `WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(params.length)} AND deleted_at IS NULL`;
      const sql =
        sets.length > 0
          ? `UPDATE ${this.qualifiedTable} SET ${sets.join(', ')} ${where} RETURNING ${this.selectColumns}`
          : `SELECT ${this.selectColumns} FROM ${this.qualifiedTable} ${where}`;
      const rows = await this.select(sql, params);
      return rows.length > 0 ? this.mapRow(rows[0]) : null;
    }

    /** Soft delete: stamps deleted_at (the trigger owns updated_at/row_version). */
    async softDelete(id) {
      const affected = await this.execute(
        `UPDATE ${this.qualifiedTable} SET deleted_at = NOW() WHERE ${this.primaryKeyColumn} = ${this.pkPlaceholder(1)} AND deleted_at IS NULL`,
        [id],
      );
      return affected > 0;
    }

    // ── Helpers for the per-aggregate finders ─────────────────────────────

    listWhere(filters, page) {
      return this.list({ filters, limit: page?.limit, offset: page?.offset });
    }

    countWhere(filters) {
      return this.count({ filters });
    }

    /**
     * Rows whose `field` is among the ids `subquery` returns (e.g. the cohorts of a
     * school's programs), filtered and paged in one query. `subquery` is a constant
     * written in a repository, never built from input; its values come in `subParams`.
     */
    listInSubquery(field, subquery, subParams, page) {
      const sql = `SELECT ${this.selectColumns} FROM ${this.qualifiedTable} WHERE deleted_at IS NULL AND ${this.columnOf(field)} IN (${subquery}) ORDER BY ${this.orderByClause}`;
      return this.paged(sql, [...subParams], page ?? {});
    }

    async countInSubquery(field, subquery, subParams) {
      const rows = await this.select(
        `SELECT COUNT(*)::int AS total FROM ${this.qualifiedTable} WHERE deleted_at IS NULL AND ${this.columnOf(field)} IN (${subquery})`,
        subParams,
      );
      return Number(rows[0]?.total ?? 0);
    }

    /** Appends LIMIT/OFFSET as bind parameters and maps the rows. */
    async paged(sql, params, page) {
      let text = sql;
      if (page.limit !== undefined) {
        params.push(page.limit);
        text += ` LIMIT $${params.length}`;
      }
      if (page.offset !== undefined) {
        params.push(page.offset);
        text += ` OFFSET $${params.length}`;
      }
      const rows = await this.select(text, params);
      return rows.map((row) => this.mapRow(row));
    }
  }
  return PostgresCrudRepository;
}

// ── Value coercion shared by the column maps ────────────────────────────

/** BIGINT/INT columns arrive as numbers (see database.js parsers). */
function toInt(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Number in the API, VARCHAR in PostgreSQL: written as text. */
function intToText(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

/** `date` columns: pass the `YYYY-MM-DD` wire text straight through. */
function dateParam(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).slice(0, 10);
}

/** Smallint/int columns: reject anything that is not a finite number. */
function numberParam(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

module.exports = { definePostgresCrudRepository, toInt, intToText, dateParam, numberParam };
