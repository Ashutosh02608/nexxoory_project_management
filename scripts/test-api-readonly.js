import assert from 'node:assert/strict';
import { query, closePool } from '../server/config/db.js';
import { signAccessToken } from '../server/utils/jwt.js';
import handler from '../api/v1/data.js';

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    end(body) { this.body = JSON.parse(body); },
  };
}

async function call(user, entity, action = 'list') {
  const res = response();
  await handler({
    method: 'POST',
    headers: {
      authorization: `Bearer ${signAccessToken(user)}`,
      origin: 'http://localhost:5173',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: { entity, action, payload: {} },
  }, res);
  assert.equal(res.statusCode, 200, `${user.role} ${entity}/${action} failed: ${JSON.stringify(res.body)}`);
}

try {
  const users = await query(`
    SELECT DISTINCT ON (role) id, name, email, role, status
    FROM users WHERE status = 'Active' ORDER BY role, created_at;
  `);
  assert.ok(users.rows.length, 'At least one active user is required');
  for (const user of users.rows) {
    await call(user, 'bootstrap', 'get');
    for (const entity of ['projects', 'tasks', 'documents', 'calendar-events']) {
      await call(user, entity);
    }
  }
  console.log(`Read-only API SQL checks passed for ${users.rows.length} role(s)`);
} finally {
  await closePool();
}
