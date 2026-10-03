const { test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { ensureOwner } = require('../src/owner-account');

const config = { OWNER_USERNAME: ' SCOT ', OWNER_PASSWORD: ' synthetic password ', OWNER_NAME: 'Test Owner' };
function database(responses) {
  const calls = [];
  return {
    calls,
    async execute(sql, params) {
      calls.push({ sql, params });
      assert.ok(responses.length, 'Unexpected database mutation/query');
      return [responses.shift()];
    },
  };
}

test('restart preserves an existing owner even without environment credentials', async () => {
  const owner = { id: 9, username: 'changed-owner' };
  const db = database([[owner]]);
  assert.deepEqual(await ensureOwner(db, {}), owner);
  assert.equal(db.calls.length, 1);
});

test('stale environment credentials never overwrite an existing owner at startup', async () => {
  const db = database([[{ id: 9, username: 'changed-owner' }]]);
  await ensureOwner(db, config);
  assert.equal(db.calls.length, 1);
});

test('bootstrap hashes the exact password including surrounding spaces', async () => {
  const db = database([[], [], { insertId: 12 }]);
  assert.deepEqual(await ensureOwner(db, config), { id: 12, username: 'SCOT' });
  const [username, hash] = db.calls[2].params;
  assert.equal(username, 'SCOT');
  assert.equal(await bcrypt.compare(config.OWNER_PASSWORD, hash), true);
  assert.equal(await bcrypt.compare(config.OWNER_PASSWORD.trim(), hash), false);
});

test('explicit reset targets the existing owner ID', async () => {
  const db = database([[{ id: 9, username: 'changed-owner' }], [], { affectedRows: 1 }]);
  await ensureOwner(db, config, { reset: true });
  assert.match(db.calls[2].sql, /WHERE id=\? AND role='Owner'/);
  assert.equal(db.calls[2].params[3], 9);
  assert.equal(await bcrypt.compare(config.OWNER_PASSWORD, db.calls[2].params[1]), true);
});

test('reset cannot take an administrator username', async () => {
  const db = database([[{ id: 9, username: 'changed-owner' }], [{ id: 10 }]]);
  await assert.rejects(ensureOwner(db, config, { reset: true }), /another account/);
  assert.equal(db.calls.length, 2);
});

test('missing or short bootstrap credentials fail without writes', async () => {
  for (const env of [{}, { OWNER_USERNAME: 'SCOT', OWNER_PASSWORD: 'short' }]) {
    const db = database([[]]);
    await assert.rejects(ensureOwner(db, env), /OWNER_/);
    assert.equal(db.calls.length, 1);
  }
});
