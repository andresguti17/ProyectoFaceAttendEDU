/**
 * Generic PostgreSQL CRUD adapter of 07-ms-configuration: the base shared by the Node services
 * (back-end/shared/node-infra/crud.js) bound to this service's database module.
 * Values always travel as bind parameters; identifiers only come from the static
 * FieldSpec declarations of each repository.
 */
import { definePostgresCrudRepository } from '@faceattend/infra/crud';
import { runCommand, runQuery } from '../../db/database';

export type { Row, JsonRecord, FieldSpec, ColumnFilter, ListQuery } from '@faceattend/infra/crud';
export { toInt, intToText, dateParam, numberParam } from '@faceattend/infra/crud';

// Looked up on every call, so tests that mock the database module intercept the SQL.
export const PostgresCrudRepository = definePostgresCrudRepository({
  runQuery: (sql, params) => runQuery(sql, params),
  runCommand: (sql, params) => runCommand(sql, params),
});
