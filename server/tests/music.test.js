// Checks for the music service: generated audio, providers, Spotify mapping.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// A pretend Spotify, so no real account is needed.
let spotifyMode = 'ok';
const spotifyRequests = [];
const fakeSpotify = http.createServer((req, res) => {
  spotifyRequests.push({ url: req.url, auth: req.headers.authorization });
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (req.url.startsWith('/api/token')) {
    if (spotifyMode === 'bad-credentials') return json(400, { error: 'invalid_client' });
    return json(200, { access_token: 'tok', token_type: 'Bearer', expires_in: 3600 });
  }
  if (req.url.startsWith('/v1/search')) {
    if (spotifyMode === 'forbidden') return json(403, { error: { status: 403, message: 'premium required' } });
    return json(200, {
      tracks: {
        items: [
          {
            id: 'AbC123',
            name: 'Real Song',
            artists: [{ name: 'Real Artist' }, { name: 'Guest' }],
            album: { name: 'Album', release_date: '2019-05-01', images: [{ url: 'https://i/640', width: 640 }, { url: 'https://i/300', width: 300 }, { url: 'https://i/64', width: 64 }] },
            duration_ms: 201000,
            preview_url: null,
            external_urls: { spotify: 'https://open.spotify.com/track/AbC123' },
          },
          {
            id: 'Prev1',
            name: 'Has Preview',
            artists: [{ name: 'Someone' }],
            album: { name: 'X', release_date: '2001', images: [] },
            duration_ms: 1000,
            preview_url: 'https://p.scdn.co/mp3-preview/xyz',
            external_urls: { spotify: 'https://open.spotify.com/track/Prev1' },
          },
        ],
      },
    });
  }
  json(404, {});
});

let server;
let baseUrl;
let synth;
let SONGS;
let recommend;

before(async () => {
  await new Promise((resolve) => fakeSpotify.listen(0, resolve));
  const fake = `http://127.0.0.1:${fakeSpotify.address().port}`;
  Object.assign(process.env, {
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    SPOTIFY_CLIENT_ID: 'id',
    SPOTIFY_CLIENT_SECRET: 'secret',
    SPOTIFY_API_BASE: fake,
    SPOTIFY_ACCOUNTS_BASE: fake,
    SPOTIFY_MARKET: 'MY',
    JAMENDO_CLIENT_ID: '',
  });
  synth = await import('../src/services/music/synth.js');
  ({ SONGS } = await import('../src/data/songs.js'));
  ({ recommend } = await import('../src/services/recommendation/engine.js'));
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fakeSpotify.close();
});

test('generated audio is a valid 30-second WAV and is the same every time', () => {
  const song = SONGS.find((item) => item.id === 'static-lullaby');
  const wav = synth.renderSongWav(song);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), synth.SAMPLE_RATE);
  assert.equal(wav.readUInt32LE(40), synth.SAMPLE_RATE * synth.CLIP_SECONDS * 2);
  assert.ok(synth.renderSongWav(song).equals(wav), 'same song must produce the same audio');
  const other = synth.renderSongWav(SONGS.find((item) => item.id === 'run-the-red'));
  assert.ok(!other.equals(wav), 'different songs must sound different');
});

test('calm and energetic songs differ in loudness and never clip', () => {
  const rms = (id) => {
    const samples = synth.composeSong(SONGS.find((item) => item.id === id));
    let sum = 0;
    let peak = 0;
    for (const value of samples) {
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    assert.ok(peak <= 0.86, `${id} peak ${peak}`);
    return Math.sqrt(sum / samples.length);
  };
  assert.ok(rms('run-the-red') > rms('empty-lobby-music'));
});

test('every song in the API carries playback information', async () => {
  const body = await (await fetch(`${baseUrl}/api/songs?limit=100`)).json();
  for (const song of body.songs) {
    assert.equal(song.playback.status, 'preview', song.id);
    assert.equal(song.playback.audio_url, `/api/audio/sample/${song.id}.wav`);
  }
});

test('GET /api/audio/sample/:id.wav serves audio and supports seeking', async () => {
  const full = await fetch(`${baseUrl}/api/audio/sample/sunroom.wav`);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('content-type'), 'audio/wav');
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal(full.headers.get('cross-origin-resource-policy'), 'cross-origin');
  const bytes = Buffer.from(await full.arrayBuffer());
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');

  const part = await fetch(`${baseUrl}/api/audio/sample/sunroom.wav`, { headers: { Range: 'bytes=1000-1999' } });
  assert.equal(part.status, 206);
  assert.equal((await part.arrayBuffer()).byteLength, 1000);

  assert.equal((await fetch(`${baseUrl}/api/audio/sample/not-a-song.wav`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/audio/sample/..%2Fsecret.wav`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/audio/sample/sunroom.mp3`)).status, 400);
});

test('providers endpoint and health list the music providers', async () => {
  const providers = (await (await fetch(`${baseUrl}/api/music/providers`)).json()).providers;
  assert.equal(providers.sample.enabled, true);
  assert.equal(providers.spotify.enabled, true);
  assert.equal(providers.jamendo.enabled, false);
  const health = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(health.music.sample, true);
  assert.equal(health.music.spotify, true);
});

test('Spotify search maps tracks and states clearly what can be played', async () => {
  spotifyMode = 'ok';
  spotifyRequests.length = 0;
  const body = await (await fetch(`${baseUrl}/api/music/search?q=real%20song&limit=10&source=spotify`)).json();
  assert.equal(body.count, 2);
  const [noPreview, withPreview] = body.songs;

  assert.equal(noPreview.title, 'Real Song');
  assert.equal(noPreview.artist, 'Real Artist, Guest');
  assert.equal(noPreview.artwork_url, 'https://i/300');
  assert.equal(noPreview.external, true);
  assert.match(noPreview.id, /^[a-z0-9-]+$/);
  assert.equal(noPreview.playback.status, 'external');
  assert.equal(noPreview.playback.audio_url, null);
  assert.deepEqual(noPreview.playback.links.map((link) => link.provider), ['spotify', 'youtube']);
  assert.match(noPreview.playback.links[1].url, /youtube\.com\/results\?search_query=Real%20Song%20Real%20Artist/);

  assert.equal(withPreview.playback.status, 'preview');
  assert.equal(withPreview.playback.audio_url, 'https://p.scdn.co/mp3-preview/xyz');

  const search = spotifyRequests.find((request) => request.url.startsWith('/v1/search'));
  assert.equal(search.auth, 'Bearer tok');
  assert.match(search.url, /limit=10/);
  assert.match(search.url, /market=MY/);
  assert.match(spotifyRequests.find((request) => request.url.startsWith('/api/token')).auth, /^Basic /);
});

test('Spotify problems are explained, not crashes', async () => {
  const { resetSpotifyToken } = await import('../src/services/music/providers/spotify.provider.js');
  spotifyMode = 'forbidden';
  let res = await fetch(`${baseUrl}/api/music/search?q=x&source=spotify`);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error.message, /Premium/);

  resetSpotifyToken();
  spotifyMode = 'bad-credentials';
  res = await fetch(`${baseUrl}/api/music/search?q=x&source=spotify`);
  assert.equal(res.status, 502);
  assert.match((await res.json()).error.message, /credentials/);

  assert.equal((await fetch(`${baseUrl}/api/music/search?q=`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/music/search?q=x&limit=50`)).status, 400);
  spotifyMode = 'ok';
  resetSpotifyToken();
});

test('skipped songs gently lower similar songs, less than a rejection', () => {
  const profile = { moods: ['calm'], energy: 30, intensity: 30, genres: [], desired_effect: 'atmosphere', tempo: 'any' };
  const scoreOf = (result, id) => [...result.recommendations, ...result.reserve].find((item) => item.song.id === id)?.breakdown.history;
  const neutral = recommend({ profile, songs: SONGS });
  const skipped = recommend({ profile, songs: SONGS, feedback: { skipped: ['lake-at-six'] } });
  // Another classical / Otto Lind song is affected by skipping "Lake at Six".
  const target = 'nocturne-for-two';
  assert.equal(scoreOf(neutral, target), 50);
  assert.ok(scoreOf(skipped, target) < 50);
  // Skipped songs are not hidden (unlike rejected ones).
  assert.ok([...skipped.recommendations, ...skipped.reserve].some((item) => item.song.id === 'lake-at-six'));
});
