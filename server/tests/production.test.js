// Production settings: several allowed frontends, proxy trust, access log.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

Object.assign(process.env, {
  NODE_ENV: 'production',
  CLIENT_ORIGIN: 'https://moodify.example.app, http://localhost:5173/',
  SUPABASE_URL: '',
  SUPABASE_PUBLISHABLE_KEY: '',
  DOTENV_CONFIG_PATH: '/nonexistent',
});

let server;
let baseUrl;
let env;
const logged = [];
const originalLog = console.log;

before(async () => {
  console.log = (...args) => logged.push(args.join(' '));
  ({ env } = await import('../src/config/env.js'));
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  console.log = originalLog;
  server.close();
});

test('several frontend addresses are allowed; others are not', async () => {
  assert.deepEqual(env.clientOrigins, ['https://moodify.example.app', 'http://localhost:5173']);
  assert.equal(env.clientOrigin, 'https://moodify.example.app');
  for (const origin of env.clientOrigins) {
    const res = await fetch(`${baseUrl}/api/health`, { headers: { Origin: origin } });
    assert.equal(res.headers.get('access-control-allow-origin'), origin);
  }
  const evil = await fetch(`${baseUrl}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
});

test('the hosting proxy is trusted in production', () => {
  assert.equal(env.trustProxy, 1);
});

test('the access log has no query strings or personal data', async () => {
  await fetch(`${baseUrl}/api/songs?q=secret-search&limit=1`);
  const line = logged.find((entry) => entry.startsWith('GET /api/songs'));
  assert.ok(line, 'request should be logged');
  assert.ok(!line.includes('secret-search'));
  assert.match(line, /^GET \/api\/songs 200 \d+ms$/);
});

test('internal error details are hidden in production', async () => {
  const { errorHandler } = await import('../src/middleware/errorHandler.js');
  let sent;
  const res = { status: (code) => ({ json: (body) => (sent = { code, body }) }) };
  const originalError = console.error;
  console.error = () => {};
  errorHandler(new Error('database password is hunter2'), {}, res, () => {});
  console.error = originalError;
  assert.equal(sent.code, 500);
  assert.equal(sent.body.error.message, 'Internal server error');
});
