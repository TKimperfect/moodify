// Checks for the song and recommendation endpoints. Run with: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (path, body) =>
  fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const profile = { moods: ['sad', 'lonely'], energy: 20, intensity: 85, genres: ['indie'], desired_effect: 'comfort', tempo: 'slow' };

test('POST /api/recommendations returns 10 explained songs', async () => {
  const res = await post('/api/recommendations', { profile });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'rule-based');
  assert.equal(body.recommendations.length, 10);
  const first = body.recommendations[0];
  assert.ok(first.song.title && first.song.artist);
  assert.ok(first.match > 0 && first.match <= 100);
  assert.ok(first.reasons.length > 0);
  assert.deepEqual(Object.keys(first.breakdown).sort(), ['effect', 'genre', 'history', 'mood', 'tempo_energy']);
});

test('POST /api/recommendations honours limit and feedback', async () => {
  const first = await (await post('/api/recommendations', { profile, limit: 3 })).json();
  assert.equal(first.recommendations.length, 3);
  const rejected = [first.recommendations[0].song.id];
  const second = await (await post('/api/recommendations', { profile, limit: 3, feedback: { rejected } })).json();
  assert.ok(!second.recommendations.some((item) => item.song.id === rejected[0]));
});

test('POST /api/recommendations rejects invalid input with details', async () => {
  const cases = [
    {},
    { profile: { ...profile, moods: [] } },
    { profile: { ...profile, moods: ['sad', 'sad'] } },
    { profile: { ...profile, moods: ['sleepy'] } },
    { profile: { ...profile, energy: 101 } },
    { profile: { ...profile, desired_effect: 'hypnotise' } },
    { profile: { ...profile, extra: true } },
    { profile, limit: 500 },
    { profile, feedback: { liked: ['<script>'] } },
  ];
  for (const body of cases) {
    const res = await post('/api/recommendations', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    const json = await res.json();
    assert.equal(json.error.message, 'Invalid request');
    assert.ok(json.error.details.length > 0);
  }
});

test('GET /api/songs searches by text, mood and genre', async () => {
  const all = await (await fetch(`${baseUrl}/api/songs?limit=100`)).json();
  assert.ok(all.count >= 60);

  const text = await (await fetch(`${baseUrl}/api/songs?q=lullaby`)).json();
  assert.equal(text.songs[0].id, 'static-lullaby');

  const filtered = await (await fetch(`${baseUrl}/api/songs?mood=angry&genre=rock`)).json();
  assert.ok(filtered.count > 0);
  assert.ok(filtered.songs.every((song) => song.moods.includes('angry') && song.genres.includes('rock')));

  const byIds = await (await fetch(`${baseUrl}/api/songs?ids=sunroom,teeth,nope`)).json();
  assert.deepEqual(byIds.songs.map((song) => song.id), ['sunroom', 'teeth']);

  assert.equal((await fetch(`${baseUrl}/api/songs?mood=sleepy`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/songs?limit=9999`)).status, 400);
});

test('GET /api/songs pages through the matches ("Show more")', async () => {
  const first = await (await fetch(`${baseUrl}/api/songs?limit=24`)).json();
  assert.equal(first.count, 24);
  assert.ok(first.total > 24); // all matching songs, not just this page
  const second = await (await fetch(`${baseUrl}/api/songs?limit=24&offset=24`)).json();
  assert.equal(second.offset, 24);
  assert.equal(second.total, first.total);
  const ids = [...first.songs, ...second.songs].map((song) => song.id);
  assert.equal(new Set(ids).size, ids.length); // no song twice
  const past = await (await fetch(`${baseUrl}/api/songs?limit=24&offset=${first.total}`)).json();
  assert.equal(past.count, 0);
  assert.equal((await fetch(`${baseUrl}/api/songs?offset=-1`)).status, 400);
});

test('GET /api/songs can shuffle: the same seed keeps its order across pages, another seed mixes again', async () => {
  const get = async (query) => (await (await fetch(`${baseUrl}/api/songs?${query}`)).json()).songs.map((song) => song.id);
  const popular = await get('limit=24');
  const a = await get('limit=24&sort=shuffle&seed=11');
  assert.deepEqual(await get('limit=24&sort=shuffle&seed=11'), a); // same seed, same order
  assert.notDeepEqual(a, popular);
  assert.notDeepEqual(await get('limit=24&sort=shuffle&seed=12'), a);
  const next = await get('limit=24&offset=24&sort=shuffle&seed=11');
  assert.equal(new Set([...a, ...next]).size, 48); // "Show more" never repeats a song
  assert.equal((await fetch(`${baseUrl}/api/songs?sort=random`)).status, 400);
});

test('GET /api/songs/:id returns one song or 404', async () => {
  const ok = await fetch(`${baseUrl}/api/songs/sunroom`);
  assert.equal((await ok.json()).song.title, 'Sunroom');
  assert.equal((await fetch(`${baseUrl}/api/songs/not-a-song`)).status, 404);
});

test('GET /api/songs/discover returns every section', async () => {
  const body = await (await fetch(`${baseUrl}/api/songs/discover`)).json();
  assert.equal(body.featured.length, 6);
  assert.equal(body.trending.length, 8);
  assert.equal(body.hidden_gems.length, 8);
  assert.ok(body.hidden_gems.every((song) => song.popularity < 40));
  assert.equal(body.genres.length, 12);
  assert.equal(body.moods.length, 10);
  assert.ok(body.moods.every((mood) => mood.count > 0));
});
