import assert from 'node:assert/strict';
import pg from 'pg';
import { signAccessToken } from '../server/utils/jwt.js';

const userId = 'b1b42301-c7e2-446b-84c4-ad96ec34b2c5';
const resourceId = 'f4c5b127-c7e2-446b-84c4-ad96ec34b2c5';
let role = 'team_member';
let queries = [];

pg.Pool.prototype.query = async (sql, params = []) => {
  queries.push({ sql, params });
  if (sql === 'SELECT 1;') return { rows: [] };
  if (sql.includes('FROM users') && sql.includes('WHERE id = $1')) {
    return { rows: [{ id: userId, name: 'Test User', role, status: 'Active' }] };
  }
  if (sql.includes('FROM projects p')) return { rows: [] };
  if (sql.includes('UPDATE documents d')) return { rows: [], rowCount: 0 };
  return { rows: [], rowCount: 0 };
};

const { default: handler } = await import('../api/v1/data.js');

function token() {
  return signAccessToken({ id: userId, role });
}

async function request(entity, action, payload = {}, overrides = {}) {
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    end(body) { this.body = JSON.parse(body); },
  };
  await handler({
    method: 'POST',
    headers: {
      authorization: `Bearer ${token()}`,
      origin: 'http://localhost:5173',
      'x-requested-with': 'XMLHttpRequest',
      ...overrides,
    },
    body: { entity, action, payload },
  }, response);
  return response;
}

const badOrigin = await request('projects', 'list', {}, { origin: 'https://localhost.attacker.example' });
assert.equal(badOrigin.statusCode, 403);
assert.equal(badOrigin.body.error.code, 'FORBIDDEN_ORIGIN');
const originalDeploymentEnv = [process.env.VERCEL, process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL];
process.env.VERCEL = '1';
process.env.VERCEL_URL = 'this-project-preview.vercel.app';
process.env.VERCEL_PROJECT_PRODUCTION_URL = 'this-project.vercel.app';
for (const origin of ['https://this-project-preview.vercel.app', 'https://this-project.vercel.app']) {
  assert.equal((await request('projects', 'list', {}, { origin })).statusCode, 200);
}
for (const origin of ['https://another-project.vercel.app', 'https://this-project.vercel.app.attacker.example']) {
  assert.equal((await request('projects', 'list', {}, { origin })).statusCode, 403);
}
['VERCEL', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL'].forEach((key, index) => {
  if (originalDeploymentEnv[index] === undefined) delete process.env[key];
  else process.env[key] = originalDeploymentEnv[index];
});

const missingCsrf = await request('projects', 'list', {}, { 'x-requested-with': '' });
assert.equal(missingCsrf.statusCode, 403);
assert.equal(missingCsrf.body.error.code, 'CSRF_VALIDATION_FAILED');

queries = [];
const projects = await request('projects', 'list');
assert.equal(projects.statusCode, 200);
assert.match(queries.at(-1).sql, /scope_member\.user_id/);

const projectUpdate = await request('projects', 'update', { id: resourceId, name: 'Forbidden' });
assert.equal(projectUpdate.statusCode, 403);

const documentUpdate = await request('documents', 'update', { id: resourceId, name: 'Forbidden' });
assert.equal(documentUpdate.statusCode, 404);
assert.match(queries.at(-1).sql, /assigned_user_ids/);

const taskCreate = await request('tasks', 'create', {
  clientMutationId: resourceId,
  projectId: resourceId,
  title: 'Forbidden',
});
assert.equal(taskCreate.statusCode, 403);

assert.match(projects.headers['x-request-id'], /^[0-9a-f-]{36}$/i);
console.log('API origin, CSRF, scope, mutation and request ID checks passed');
