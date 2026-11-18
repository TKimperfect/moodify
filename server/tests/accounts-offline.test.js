// With NO Supabase configured, MOODIFY must keep working for visitors and
// answer account requests with a clear "not available" message.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Make sure a developer's real .env does not leak into this test.
process.env.SUPABASE_URL = '';
process.env.SUPABASE_PUBLISHABLE_KEY = '';
process.env.SUPABASE_ANON_KEY = '';
process.env.DOTENV_CONFIG_PATH = '/nonexistent';

let server;
let baseUrl;

before(async () => {
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const send = (method, path, body, token) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

test('health reports the built-in songs when there is no database', async () => {
  const body = await (await send('GET', '/api/health')).json();
  assert.equal(body.database.configured, false);
  assert.equal(body.database.connected, false);
  assert.equal(body.database.song_source, 'local');
  assert.ok(body.database.songs >= 60);
});

test('account routes answer 503 with a clear message', async () => {
  const routes = [
    ['GET', '/api/favorites'],
    ['GET', '/api/playlists'],
    ['GET', '/api/history'],
    ['GET', '/api/mood-sessions'],
    ['GET', '/api/auth/me'],
    ['POST', '/api/auth/login', { email: 'a@example.com', password: 'password123' }],
    ['POST', '/api/auth/register', { email: 'a@example.com', password: 'password123' }],
  ];
  for (const [method, path, body] of routes) {
    const res = await send(method, path, body, 'some-token');
    assert.equal(res.status, 503, `${method} ${path}`);
    assert.match((await res.json()).error.message, /not configured/);
  }
});

test('recommendations still work, even with a token attached', async () => {
  const profile = { moods: ['calm'], energy: 30, intensity: 30, genres: [], desired_effect: 'atmosphere', tempo: 'any' };
  const res = await send('POST', '/api/recommendations', { profile }, 'some-token');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.recommendations.length, 10);
  assert.equal(body.personalised, false);
});

test('account input is validated before anything else', async () => {
  const cases = [
    ['/api/auth/register', { email: 'not-an-email', password: 'password123' }],
    ['/api/auth/register', { email: 'a@example.com', password: 'short' }],
    ['/api/auth/register', { email: 'a@example.com', password: 'password123', role: 'admin' }],
    ['/api/auth/login', { email: 'a@example.com' }],
    ['/api/auth/refresh', {}],
  ];
  for (const [path, body] of cases) {
    const res = await send('POST', path, body);
    assert.equal(res.status, 400, `${path} ${JSON.stringify(body)}`);
  }
});

test('security headers are present', async () => {
  const res = await send('GET', '/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});
