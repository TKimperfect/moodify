// Checks for the Jamendo and Deezer providers, the Jamendo import and the
// imported catalogue, using pretend Jamendo and Deezer servers.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const jamendoTrack = (id, extra = {}) => ({
  id: String(id),
  name: `Song ${id}`,
  duration: 201,
  artist_name: `Artist ${id}`,
  album_name: 'Album',
  album_image: `https://usercontent.jamendo.com/?type=album&id=${id}&width=300`,
  releasedate: '2018-04-02',
  audio: `https://prod-1.storage.jamendo.com/?trackid=${id}&format=mp32`,
  audiodownload: '',
  shareurl: `https://www.jamendo.com/track/${id}`,
  license_ccurl: 'http://creativecommons.org/licenses/by-nc-sa/3.0/',
  musicinfo: { vocalinstrumental: 'vocal', speed: 'low', tags: { genres: ['pop', 'indie'], instruments: ['piano'], vartags: ['sad', 'emotional'] } },
  ...extra,
});

let jamendoMode = 'ok';
let deezerMode = 'ok';
const jamendoRequests = [];
let deezerCalls = 0;

const fake = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/v3.0/tracks/') {
    jamendoRequests.push(url.searchParams);
    if (jamendoMode === 'bad-client') return json(200, { headers: { status: 'failed', code: 5, error_message: 'Your credential is not authorized (client_id)' }, results: [] });
    const tags = url.searchParams.get('fuzzytags') ?? '';
    // One track shared by two moods, one without audio (must be dropped).
    const results = tags.startsWith('sad')
      ? [jamendoTrack(1), jamendoTrack(2, { audio: '' }), jamendoTrack(3)]
      : tags === 'melancholy'
        ? [jamendoTrack(3), jamendoTrack(4)]
        : url.searchParams.get('search')
          ? [jamendoTrack(9, { musicinfo: undefined, license_ccurl: 'http://creativecommons.org/licenses/by/4.0/' })]
          : [];
    return json(200, { headers: { status: 'success', code: 0, results_count: results.length }, results });
  }
  if (url.pathname === '/search') {
    deezerCalls += 1;
    if (deezerMode === 'quota') return json(200, { error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } });
    return json(200, {
      data: [
        { id: 3135556, type: 'track', title: 'Harder, Better, Faster, Stronger', duration: 224, preview: 'https://cdnt-preview.dzcdn.net/api/1/1/a.mp3', link: 'https://www.deezer.com/track/3135556', artist: { name: 'Daft Punk' }, album: { title: 'Discovery', cover_medium: 'https://e-cdns-images.dzcdn.net/250x250.jpg' } },
        { id: 42, type: 'track', title: 'No Preview Song', duration: 180, preview: '', link: 'https://www.deezer.com/track/42', artist: { name: 'Someone' }, album: { title: 'X' } },
      ],
      total: 2,
    });
  }
  json(404, {});
});

let baseUrl;
let server;
let mapJamendoTrack;
let licenceName;
let importJamendo;
let songRepository;
let loadImportedSongs;
let recommend;
let tmpDir;

before(async () => {
  await new Promise((resolve) => fake.listen(0, resolve));
  const fakeUrl = `http://127.0.0.1:${fake.address().port}`;
  Object.assign(process.env, {
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    JAMENDO_CLIENT_ID: 'test-client',
    JAMENDO_API_BASE: fakeUrl,
    DEEZER_API_BASE: fakeUrl,
    DEEZER_ENABLED: 'true',
  });
  ({ mapJamendoTrack, licenceName } = await import('../src/services/music/providers/jamendo.provider.js'));
  ({ importJamendo } = await import('../src/services/music/jamendoImport.js'));
  ({ songRepository, loadImportedSongs } = await import('../src/repositories/song.repository.js'));
  ({ recommend } = await import('../src/services/recommendation/engine.js'));
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  tmpDir = mkdtempSync(path.join(os.tmpdir(), 'moodify-test-'));
});
after(() => {
  server.close();
  fake.close();
});

test('licence names are readable', () => {
  assert.equal(licenceName('http://creativecommons.org/licenses/by-nc-sa/3.0/'), 'CC BY-NC-SA 3.0');
  assert.equal(licenceName('https://creativecommons.org/licenses/by/4.0/'), 'CC BY 4.0');
  assert.equal(licenceName(null), 'Creative Commons');
});

test('a Jamendo track becomes a catalogue song the engine understands', () => {
  const song = mapJamendoTrack(jamendoTrack(7), { hintMood: 'lonely', rank: 0 });
  assert.equal(song.id, 'jamendo-7');
  assert.deepEqual(song.genres, ['pop', 'indie']);
  assert.deepEqual(song.moods, ['lonely', 'sad']);
  assert.equal(song.energy, 30); // speed "low"
  assert.equal(song.tempo, 'slow');
  assert.ok(song.intensity > 65); // "emotional" makes it stronger
  assert.ok(song.effects.includes('companionship'));
  assert.equal(song.preview_url, 'https://prod-1.storage.jamendo.com/?trackid=7&format=mp32');
  assert.equal(song.license_url, 'http://creativecommons.org/licenses/by-nc-sa/3.0/');
  assert.equal(song.duration_s, 201);
  assert.equal(song.year, 2018);
});

test('missing Jamendo details get sensible defaults', () => {
  const song = mapJamendoTrack({ id: '5', name: 'Bare', artist_name: 'A', audio: 'https://x/5' }, { hintMood: 'angry' });
  assert.deepEqual(song.moods, ['angry']);
  assert.deepEqual(song.genres, ['indie']);
  assert.equal(song.energy, 80);
  assert.ok(song.effects.includes('release'));
  assert.ok(['slow', 'medium', 'fast'].includes(song.tempo));
});

test('the import collects songs per mood, merges duplicates and drops songs without audio', async () => {
  jamendoMode = 'ok';
  jamendoRequests.length = 0;
  const { songs, failures } = await importJamendo({ perMood: 5 });
  assert.deepEqual(failures, []);
  // "lonely" found nothing with its combined tags, so single tags were tried
  // and "melancholy" found songs 3 and 4 (song 3 is also a "sad" song).
  assert.deepEqual(songs.map((song) => song.id).sort(), ['jamendo-1', 'jamendo-3', 'jamendo-4']);
  const shared = songs.find((song) => song.id === 'jamendo-3');
  assert.deepEqual(shared.moods.sort(), ['lonely', 'sad']);
  assert.ok(songs.find((song) => song.id === 'jamendo-4').moods.includes('lonely'));
  const first = jamendoRequests[0];
  assert.equal(first.get('client_id'), 'test-client');
  assert.equal(first.get('limit'), '5');
  assert.match(first.get('include'), /musicinfo/);
  assert.ok(jamendoRequests.some((params) => params.get('fuzzytags') === 'melancholy'));
});

test('a wrong Jamendo client id stops the import with a clear message', async () => {
  jamendoMode = 'bad-client';
  await assert.rejects(importJamendo({ perMood: 5 }), /client_id/);
  jamendoMode = 'ok';
});

test('imported songs join the catalogue, play in full and show their licence', async () => {
  const { songs } = await importJamendo({ perMood: 5 });
  const file = path.join(tmpDir, 'catalog.json');
  writeFileSync(file, JSON.stringify({ songs: [...songs, { id: 'BROKEN', title: 1 }] }));
  const loaded = loadImportedSongs(file);
  assert.equal(loaded.length, songs.length); // the damaged entry is ignored
  assert.equal(loaded.length, 3);

  const catalogue = [...(await songRepository.findAll()), ...loaded];
  const profile = { moods: ['sad', 'lonely'], energy: 30, intensity: 75, genres: ['pop'], desired_effect: 'comfort', tempo: 'slow' };
  const result = recommend({ profile, songs: catalogue, limit: 20 });
  const imported = [...result.recommendations, ...result.reserve].find((item) => item.song.id === 'jamendo-1');
  assert.ok(imported, 'an imported song should be recommended for a matching mood');

  const { withPlayback } = await import('../src/services/music/music.service.js');
  const playback = withPlayback(loaded[0]).playback;
  assert.equal(playback.status, 'preview');
  assert.equal(playback.full, true);
  assert.match(playback.label, /Full song · CC BY-NC-SA 3\.0 via Jamendo/);
  assert.deepEqual(playback.links.map((link) => link.provider), ['jamendo', 'licence']);
});

test('a missing imported-songs file is not an error', () => {
  assert.deepEqual(loadImportedSongs(path.join(tmpDir, 'does-not-exist.json')), []);
});

test('Deezer search: previews play, songs without one link to Deezer', async () => {
  deezerMode = 'ok';
  const body = await (await fetch(`${baseUrl}/api/music/search?q=daft%20punk&source=deezer`)).json();
  assert.equal(body.provider, 'deezer');
  const [withPreview, without] = body.songs;
  assert.equal(withPreview.id, 'deezer-3135556');
  assert.equal(withPreview.artist, 'Daft Punk');
  assert.equal(withPreview.artwork_url, 'https://e-cdns-images.dzcdn.net/250x250.jpg');
  assert.equal(withPreview.playback.status, 'preview');
  assert.equal(withPreview.playback.label, 'Deezer preview · 30s');
  assert.equal(withPreview.playback.links[0].url, 'https://www.deezer.com/track/3135556');
  assert.equal(without.playback.status, 'external');
  assert.equal(without.playback.audio_url, null);
});

test('Deezer results are cached briefly and quota errors are explained', async () => {
  const { clearDeezerCache } = await import('../src/services/music/providers/deezer.provider.js');
  clearDeezerCache();
  const before = deezerCalls;
  await fetch(`${baseUrl}/api/music/search?q=cache%20me&source=deezer`);
  await fetch(`${baseUrl}/api/music/search?q=CACHE%20ME&source=deezer`);
  assert.equal(deezerCalls - before, 1);

  deezerMode = 'quota';
  const res = await fetch(`${baseUrl}/api/music/search?q=something%20new&source=deezer`);
  assert.equal(res.status, 503);
  assert.match((await res.json()).error.message, /busy/);
  deezerMode = 'ok';
});

test('Jamendo live search returns full songs with licences', async () => {
  const body = await (await fetch(`${baseUrl}/api/music/search?q=piano&source=jamendo`)).json();
  assert.equal(body.count, 1);
  assert.equal(body.songs[0].external, true);
  assert.match(body.songs[0].playback.label, /CC BY 4\.0/);
});

test('search sources are validated and disabled ones are refused', async () => {
  assert.equal((await fetch(`${baseUrl}/api/music/search?q=x&source=napster`)).status, 400);
  const spotify = await fetch(`${baseUrl}/api/music/search?q=x&source=spotify`);
  assert.equal(spotify.status, 503);
  const providers = (await (await fetch(`${baseUrl}/api/music/providers`)).json()).providers;
  assert.equal(providers.deezer.enabled, true);
  assert.equal(providers.jamendo.enabled, true);
});
