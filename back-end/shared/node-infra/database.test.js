'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, toIsoTimestamp, toDateOnly, sanitiseSchema, redact } = require('./database');

/** Stand-in for the `pg` module: records parsers, pool options and statements. */
function fakePg({ failOn } = {}) {
  const parsers = new Map();
  const statements = [];
  let options = null;
  class Pool {
    constructor(opts) {
      options = opts;
      this.totalCount = 1;
      this.idleCount = 1;
      this.waitingCount = 0;
    }
    on() {}
    async query(sql, params) {
      statements.push([sql, params]);
      if (failOn && sql.includes(failOn)) throw new Error('boom');
      return { rows: [{ ok: 1 }], rowCount: 3 };
    }
    async connect() {
      return { query: (sql, params) => this.query(sql, params), release() {} };
    }
    async end() {}
  }
  return {
    pg: { Pool, types: { setTypeParser: (oid, fn) => parsers.set(oid, fn) } },
    parsers,
    statements,
    options: () => options,
  };
}

test('wire values keep the API shapes (int8 as number, dates and timestamps as text)', () => {
  const fake = fakePg();
  createDatabase({ pg: fake.pg, defaultSchema: 'academic' });
  assert.equal(fake.parsers.get(20)('9007199254'), 9007199254);
  assert.equal(fake.parsers.get(1082)('2026-10-21'), '2026-10-21');
  assert.equal(fake.parsers.get(1114)('2026-10-21 08:30:05.12'), '2026-10-21T08:30:05.120Z');
  assert.equal(toIsoTimestamp(null), null);
  assert.equal(toIsoTimestamp('not a timestamp'), 'not a timestamp');
  assert.equal(toDateOnly('2026-10-21T00:00:00'), '2026-10-21');
});

test('the schema in search_path is a bare identifier or the service default', () => {
  assert.equal(sanitiseSchema('configuration', 'academic'), 'configuration');
  assert.equal(sanitiseSchema('x; DROP SCHEMA academic', 'academic'), 'academic');
  assert.equal(sanitiseSchema(undefined, 'academic'), 'academic');

  const saved = process.env.PG_SCHEMA;
  process.env.PG_SCHEMA = 'public,evil';
  try {
    const fake = fakePg();
    createDatabase({ pg: fake.pg, defaultSchema: 'notification' }).getPool();
    assert.equal(fake.options().options, '-c search_path=notification,public');
  } finally {
    if (saved === undefined) delete process.env.PG_SCHEMA;
    else process.env.PG_SCHEMA = saved;
  }
});

test('the status never shows the password', () => {
  assert.equal(redact('postgres://app:s3cret@db:5432/faceattend'), 'postgres://app:***@db:5432/faceattend');
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://app:s3cret@db:5432/faceattend';
  try {
    const status = createDatabase({ pg: fakePg().pg, defaultSchema: 'academic' }).getDatabaseStatus();
    assert.doesNotMatch(status.connectionString, /s3cret/);
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
});

test('statements always travel with bind parameters', async () => {
  const fake = fakePg();
  const db = createDatabase({ pg: fake.pg, defaultSchema: 'academic' });
  assert.deepEqual(await db.runQuery('SELECT $1::int AS ok', [1]), [{ ok: 1 }]);
  assert.equal(await db.runCommand('UPDATE x SET y = $1', [2]), 3);
  assert.deepEqual(fake.statements.slice(-2), [['SELECT $1::int AS ok', [1]], ['UPDATE x SET y = $1', [2]]]);
});

test('a failing transaction is rolled back and the error surfaces', async () => {
  const fake = fakePg({ failOn: 'INSERT' });
  const db = createDatabase({ pg: fake.pg, defaultSchema: 'academic' });
  await assert.rejects(db.withTransaction((client) => client.query('INSERT INTO t VALUES ($1)', [1])), /boom/);
  assert.deepEqual(fake.statements.map(([sql]) => sql), ['BEGIN', 'INSERT INTO t VALUES ($1)', 'ROLLBACK']);
  assert.equal(await db.withTransaction(async () => 'done'), 'done');
});

test('connect and health report the outcome', async () => {
  const db = createDatabase({ pg: fakePg().pg, defaultSchema: 'academic' });
  await db.connectDatabase({ retries: 0, retryDelayMs: 0 });
  assert.equal(db.isDatabaseConnected(), true);
  assert.equal((await db.healthCheck()).ok, true);
  await db.closeDatabase();
  assert.equal(db.isDatabaseConnected(), false);

  const down = createDatabase({ pg: fakePg({ failOn: 'SELECT' }).pg, defaultSchema: 'academic' });
  await assert.rejects(down.connectDatabase({ retries: 1, retryDelayMs: 0 }), /boom/);
  const probe = await down.healthCheck();
  assert.equal(probe.ok, false);
  assert.equal(probe.error, 'boom');
});
