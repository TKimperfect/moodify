// Runs MOODIFY against a tiny pretend Supabase (started inside this test)
// to check how the server talks to it: which key and token are sent,
// how login errors are reported, and the fallback when the database fails.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const GOOD_TOKEN = 'good-token';
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'ana@example.com', user_metadata: { display_name: 'Ana' } };
const SONG_ROW = { id: 'db-song', title: 'From The Database', artist: 'DB', genres: ['indie'], moods: ['sad'], effects: ['comfort'], energy: 20, intensity: 60, bpm: 70, tempo: 'slow', popularity: 50, year: 2024 };

const seen = []; // every request the pretend Supabase received
let songsMode = 'ok'; // 'ok' | 'empty' | 'error'
let favorites = [];
let favoriteGenres = [];

const fake = http.createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, 'http://x');
  const body = raw ? JSON.parse(raw) : null;
  seen.push({ method: req.method, path: url.pathname, query: url.searchParams, apikey: req.headers.apikey, authorization: req.headers.authorization, body });
  const json = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(data === undefined ? '' : JSON.stringify(data));
  };
  const bearer = (req.headers.authorization ?? '').replace('Bearer ', '');

  if (url.pathname === '/auth/v1/user') return bearer === GOOD_TOKEN ? json(200, USER) : json(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
    if (body.password === 'correct-password') return json(200, { access_token: GOOD_TOKEN, refresh_token: 'refresh-1', expires_in: 3600, expires_at: 1900000000, token_type: 'bearer', user: USER });
    return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
  }
  if (url.pathname === '/rest/v1/songs') {
    if (songsMode === 'error') return json(500, { code: 'XX000', message: 'boom' });
    return json(200, songsMode === 'empty' ? [] : [SONG_ROW]);
  }
  if (url.pathname === '/rest/v1/favorites') {
    if (bearer !== GOOD_TOKEN) return json(401, { code: 'PGRST301', message: 'JWT invalid' });
    if (req.method === 'GET') return json(200, favorites.map((song_id) => ({ song_id, created_at: '2026-01-01T00:00:00Z', songs: SONG_ROW })));
    if (req.method === 'POST') {
      if (body.song_id === 'missing') return json(409, { code: '23503', message: 'fk violation' });
      if (favorites.includes(body.song_id)) return json(409, { code: '23505', message: 'duplicate' });
      favorites.push(body.song_id);
      return json(201);
    }
  }
  if (url.pathname === '/rest/v1/listening_history') {
    const event = url.searchParams.get('event');
    return json(200, event === 'eq.skipped' ? [{ song_id: 'db-song' }] : []);
  }
  if (url.pathname === '/rest/v1/profiles') {
    const row = { favorite_genres: favoriteGenres };
    return json(200, String(req.headers.accept).includes('vnd.pgrst.object') ? row : [row]);
  }
  json(404, { message: `fake supabase has no ${req.method} ${url.pathname}` });
});

let server;
let baseUrl;
let songRepository;

before(async () => {
  await new Promise((resolve) => fake.listen(0, resolve));
  process.env.SUPABASE_URL = `http://127.0.0.1:${fake.address().port}`;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SECRET_KEY = '';
  const { createApp } = await import('../src/app.js');
  ({ songRepository } = await import('../src/repositories/song.repository.js'));
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fake.close();
});

const send = (method, path, { body, token } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

test('songs are read from the database when it answers', async () => {
  songsMode = 'ok';
  const health = await (await send('GET', '/api/health')).json();
  assert.deepEqual(
    { configured: health.database.configured, connected: health.database.connected, source: health.database.song_source, songs: health.database.songs },
    { configured: true, connected: true, source: 'supabase', songs: 1 },
  );
  const song = await (await send('GET', '/api/songs/db-song')).json();
  assert.equal(song.song.title, 'From The Database');
  const request = seen.findLast((entry) => entry.path === '/rest/v1/songs');
  assert.equal(request.apikey, 'sb_publishable_test');
});

test('falls back to built-in songs when the table is empty or the database fails', async () => {
  for (const mode of ['empty', 'error']) {
    songsMode = mode;
    const status = await songRepository.status({ fresh: true });
    assert.equal(status.source, 'local', mode);
    assert.ok(status.songs >= 60, mode);
    assert.ok(status.problem, mode);
  }
  const res = await send('GET', '/api/songs/static-lullaby');
  assert.equal(res.status, 200);
  songsMode = 'ok';
  await songRepository.status({ fresh: true });
});

test('protected routes need a valid token', async () => {
  assert.equal((await send('GET', '/api/favorites')).status, 401);
  assert.equal((await send('GET', '/api/favorites', { token: 'wrong' })).status, 401);
  const res = await send('GET', '/api/favorites', { token: GOOD_TOKEN });
  assert.equal(res.status, 200);
});

test("the user's own token is forwarded to the database (so RLS applies)", async () => {
  favorites = [];
  seen.length = 0;
  assert.equal((await send('PUT', '/api/favorites/db-song', { token: GOOD_TOKEN })).status, 204);
  const insert = seen.find((entry) => entry.method === 'POST' && entry.path === '/rest/v1/favorites');
  assert.equal(insert.authorization, `Bearer ${GOOD_TOKEN}`);
  assert.equal(insert.apikey, 'sb_publishable_test');
  assert.deepEqual(insert.body, { user_id: USER.id, song_id: 'db-song' });

  // Doing it twice is fine; an unknown song is a 404.
  assert.equal((await send('PUT', '/api/favorites/db-song', { token: GOOD_TOKEN })).status, 204);
  assert.equal((await send('PUT', '/api/favorites/missing', { token: GOOD_TOKEN })).status, 404);

  const list = await (await send('GET', '/api/favorites', { token: GOOD_TOKEN })).json();
  assert.equal(list.count, 1);
  assert.equal(list.favorites[0].song.id, 'db-song');
});

test('login returns a session and never echoes the password', async () => {
  const ok = await send('POST', '/api/auth/login', { body: { email: 'Ana@Example.com ', password: 'correct-password' } });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.deepEqual(body.user, { id: USER.id, email: USER.email, display_name: 'Ana' });
  assert.deepEqual(Object.keys(body.session).sort(), ['access_token', 'expires_at', 'refresh_token']);
  assert.ok(!JSON.stringify(body).includes('correct-password'));
  // Email was tidied before being sent on.
  assert.equal(seen.findLast((entry) => entry.path === '/auth/v1/token').body.email, 'ana@example.com');

  const bad = await send('POST', '/api/auth/login', { body: { email: 'ana@example.com', password: 'wrong-password' } });
  assert.equal(bad.status, 401);
  assert.equal((await bad.json()).error.message, 'Wrong email or password');
});

test('recommendations for a logged-in user are marked personalised', async () => {
  const profile = { moods: ['sad'], energy: 20, intensity: 60, genres: [], desired_effect: 'comfort', tempo: 'any' };
  const res = await send('POST', '/api/recommendations', { body: { profile }, token: GOOD_TOKEN });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).personalised, true);
});

test('ids in the address are validated', async () => {
  assert.equal((await send('GET', '/api/playlists/not-a-uuid', { token: GOOD_TOKEN })).status, 400);
  assert.equal((await send('PUT', '/api/favorites/BAD_ID!', { token: GOOD_TOKEN })).status, 400);
  assert.equal((await send('POST', '/api/history', { token: GOOD_TOKEN, body: { song_id: 'db-song', event: 'danced' } })).status, 400);
  assert.equal((await send('POST', '/api/playlists', { token: GOOD_TOKEN, body: { name: '   ' } })).status, 400);
});

test('logged-in recommendations use favourite genres and remembered skips', async () => {
  favoriteGenres = ['indie'];
  const profile = { moods: ['sad'], energy: 20, intensity: 60, genres: [], desired_effect: 'comfort', tempo: 'any' };
  const body = await (await send('POST', '/api/recommendations', { body: { profile }, token: GOOD_TOKEN })).json();
  assert.equal(body.used_favorite_genres, true);
  assert.deepEqual(body.profile.genres, ['indie']);
  // The skipped song from the history counts as a gentle "less like this".
  assert.ok(body.meta.learned_from >= 1);

  // Genres chosen for this mood win over the favourites.
  const chosen = await (await send('POST', '/api/recommendations', { body: { profile: { ...profile, genres: ['jazz'] } }, token: GOOD_TOKEN })).json();
  assert.equal(chosen.used_favorite_genres, false);
  assert.deepEqual(chosen.profile.genres, ['jazz']);
  favoriteGenres = [];
});

test('deleting an account needs confirmation and the secret key', async () => {
  assert.equal((await send('DELETE', '/api/auth/me', { body: {}, token: GOOD_TOKEN })).status, 400);
  assert.equal((await send('DELETE', '/api/auth/me', { body: { confirm: 'yes' }, token: GOOD_TOKEN })).status, 400);
  assert.equal((await send('DELETE', '/api/auth/me', { body: { confirm: 'DELETE' } })).status, 401);
  const res = await send('DELETE', '/api/auth/me', { body: { confirm: 'DELETE' }, token: GOOD_TOKEN });
  assert.equal(res.status, 501); // this test server has no secret key
  assert.match((await res.json()).error.message, /SUPABASE_SECRET_KEY/);
});
