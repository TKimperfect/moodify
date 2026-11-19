// Song languages, the Deezer language catalogue and YouTube full songs,
// tested against pretend Deezer and YouTube servers.
import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const deezerTrack = (id, title, artist, extra = {}) => ({
  id, title, readable: true, duration: 210, rank: 650000, link: `https://www.deezer.com/track/${id}`,
  artist: { name: artist }, album: { title: 'Album', cover_medium: `https://cdn/${id}.jpg` }, ...extra,
});

const youtube = { calls: [], quota: false };
const fake = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  // ---- pretend Deezer ----
  if (url.pathname === '/search/playlist') {
    const q = url.searchParams.get('q');
    // Chinese searches find nothing (like on real Deezer); the English fallback does.
    if (q === 'cantopop sad') return json(200, { data: [{ id: 11, title: 'Cantopop sad', nb_tracks: 30 }, { id: 99, title: 'tiny', nb_tracks: 2 }] });
    if (q === 'kpop happy') return json(200, { data: [{ id: 22, title: 'K happy', nb_tracks: 20 }] });
    return json(200, { data: [] });
  }
  if (url.pathname === '/playlist/11/tracks') {
    return json(200, { data: [deezerTrack(101, '富士山下', '陳奕迅'), deezerTrack(102, '사랑해', '아이유'), deezerTrack(103, '可惜我是水瓶座', '楊千嬅')] });
  }
  if (url.pathname === '/playlist/22/tracks') return json(200, { data: [deezerTrack(201, 'Dynamite', 'BTS'), deezerTrack(202, '残酷な天使のテーゼ', '高橋洋子')] });
  if (url.pathname === '/track/101') return json(200, { id: 101, preview: 'https://cdnt-preview.dzcdn.net/fresh-101.mp3' });
  if (url.pathname === '/track/103') return json(200, { id: 103, preview: '' });
  // ---- pretend YouTube ----
  if (url.pathname.startsWith('/youtube/v3/')) {
    youtube.calls.push(`${url.pathname.split('/').pop()}:${url.searchParams.get('part')}`);
    if (youtube.quota) return json(403, { error: { errors: [{ reason: 'quotaExceeded' }] } });
    if (url.pathname.endsWith('/search')) {
      return json(200, { items: [{ id: { videoId: 'cover1' } }, { id: { videoId: 'official1' } }] });
    }
    const ids = url.searchParams.get('id').split(',');
    const status = { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' };
    const snippets = {
      cover1: { title: '富士山下 cover by fan', channelTitle: 'Random Covers' },
      official1: { title: '陳奕迅 Eason Chan《富士山下》[Official MV]', channelTitle: 'Eason Chan' },
    };
    return json(200, { items: ids.map((id) => ({ id, status: id === 'gone1' ? { ...status, embeddable: false } : status, snippet: snippets[id] })) });
  }
  json(404, {});
});

let baseUrl;
let server;
let recommend;
let SONGS;
let importDeezerCatalog;
let fitsLanguage;
let loadImportedSongs;
let videoFor;
let clearYouTubeMemory;

before(async () => {
  await new Promise((resolve) => fake.listen(0, resolve));
  const fakeUrl = `http://127.0.0.1:${fake.address().port}`;
  Object.assign(process.env, {
    SUPABASE_URL: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    DEEZER_API_BASE: fakeUrl,
    DEEZER_REQUEST_GAP_MS: '0',
    YOUTUBE_API_KEY: 'yt-key',
    YOUTUBE_API_BASE: fakeUrl,
  });
  ({ recommend } = await import('../src/services/recommendation/engine.js'));
  ({ SONGS } = await import('../src/data/songs.js'));
  ({ importDeezerCatalog, fitsLanguage } = await import('../src/services/music/deezerCatalog.js'));
  ({ loadImportedSongs } = await import('../src/repositories/song.repository.js'));
  ({ videoFor, clearYouTubeMemory } = await import('../src/services/music/youtube.service.js'));
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  fake.close();
});

const song = (id, language, extra = {}) => ({
  id, title: id, artist: `Artist ${id}`, genres: ['pop'], moods: ['sad'], effects: ['comfort'], energy: 25, intensity: 70, bpm: 75, tempo: 'slow', popularity: 50, year: 2020, language, ...extra,
});
const profile = { moods: ['sad'], energy: 25, intensity: 70, genres: [], desired_effect: 'comfort', tempo: 'any' };

test('each song gets the language it is sung in, not its playlist\'s', async () => {
  const { scriptLanguage, detectLanguage } = await import('../src/services/music/language.js');
  assert.equal(scriptLanguage('富士山下 陳奕迅', 'yue'), 'yue');
  assert.equal(scriptLanguage('사랑해 아이유'), 'ko');
  assert.equal(scriptLanguage('残酷な天使のテーゼ'), 'ja');
  assert.equal(scriptLanguage('Dynamite BTS'), null);
  assert.equal(detectLanguage({ title: 'Sedih', artist: 'Siti Nurhaliza', foundIn: ['ms'] }), 'ms');
  assert.equal(detectLanguage({ title: 'Kau Ilhamku', artist: 'Man Bai', foundIn: ['en'] }), 'ms'); // Malay word
  assert.equal(detectLanguage({ title: 'Je te laisserai des mots', artist: 'Patrick Watson', foundIn: ['ja'] }), 'other');
  assert.equal(detectLanguage({ title: 'Give Me Everything', artist: 'Pitbull', foundIn: ['zh'] }, { western: new Set(['pitbull']) }), 'en');
  assert.equal(detectLanguage({ title: 'Hype Boy', artist: 'NewJeans', foundIn: ['ko'] }), 'ko'); // unknown artist: the playlist decides
});

test('the Deezer import builds language-tagged songs per mood', async () => {
  const { songs } = await importDeezerCatalog({ perMood: 10, languages: ['yue', 'ko'] });
  const ids = songs.map((item) => item.id).sort();
  assert.deepEqual(ids, ['deezer-101', 'deezer-102', 'deezer-103', 'deezer-201', 'deezer-202']);
  // A Korean song in a Cantonese playlist is Korean; a Japanese one in a Korean playlist is Japanese.
  assert.equal(songs.find((item) => item.id === 'deezer-102').language, 'ko');
  assert.equal(songs.find((item) => item.id === 'deezer-202').language, 'ja');
  const eason = songs.find((item) => item.id === 'deezer-101');
  assert.equal(eason.language, 'yue');
  assert.deepEqual(eason.moods, ['sad']);
  assert.equal(eason.title, '富士山下');
  assert.equal(eason.preview_url, null); // fetched fresh when played
  assert.equal(eason.artwork_url, 'https://cdn/101.jpg');
  assert.ok(eason.effects.includes('comfort'));
  assert.equal(songs.find((item) => item.id === 'deezer-201').language, 'ko');
});

test('choosing languages filters recommendations and explains it', () => {
  const songs = [
    ...Array.from({ length: 25 }, (_, i) => song(`yue-${i}`, 'yue')),
    ...Array.from({ length: 25 }, (_, i) => song(`ko-${i}`, 'ko')),
    ...SONGS,
  ];
  const result = recommend({ profile: { ...profile, languages: ['yue'] }, songs });
  assert.equal(result.recommendations.length, 10);
  assert.ok(result.recommendations.every((item) => item.song.language === 'yue'));
  assert.ok(result.recommendations[0].reasons.includes('Sung in Cantonese, as you asked.'));
  assert.equal(result.meta.instrumental_fill, false);
  assert.ok(result.alternative.recommendations.every((item) => item.song.language === 'yue'));

  const both = recommend({ profile: { ...profile, languages: ['yue', 'ko'] }, songs, limit: 20 });
  assert.ok(both.recommendations.every((item) => ['yue', 'ko'].includes(item.song.language)));
});

test('too few songs in a language: instrumental music fills the gap, ranked after', () => {
  const songs = [...Array.from({ length: 3 }, (_, i) => song(`nan-${i}`, 'nan')), ...SONGS];
  const result = recommend({ profile: { ...profile, languages: ['nan'] }, songs });
  assert.equal(result.recommendations.length, 10);
  assert.deepEqual(result.recommendations.slice(0, 3).map((item) => item.song.language), ['nan', 'nan', 'nan']);
  assert.ok(result.recommendations.slice(3).every((item) => item.song.language === 'instrumental'));
  assert.equal(result.meta.instrumental_fill, true);
  assert.match(result.recommendations[5].reasons.join(' '), /Instrumental, added because there are few Taiwanese Hokkien songs/);
});

test('no languages chosen: every language can be recommended', () => {
  const songs = [...Array.from({ length: 5 }, (_, i) => song(`ja-${i}`, 'ja', { energy: 25 })), ...SONGS];
  const result = recommend({ profile, songs, limit: 20 });
  const languages = new Set([...result.recommendations, ...result.reserve].map((item) => item.song.language));
  assert.ok(languages.has('ja') && languages.has('instrumental'));
});

test('imported Deezer songs load from a catalogue file', async () => {
  const { songs } = await importDeezerCatalog({ perMood: 10, languages: ['yue'] });
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'moodify-')), 'deezer.json');
  writeFileSync(file, JSON.stringify({ songs }));
  const loaded = loadImportedSongs(file);
  assert.equal(loaded.length, 3);
  const { withPlayback } = await import('../src/services/music/music.service.js');
  const playback = withPlayback(loaded[0]).playback;
  assert.equal(playback.audio_url, '/api/audio/deezer/101');
  assert.equal(playback.label, 'Deezer preview · 30s');
  assert.equal(playback.youtube, true); // full song available through YouTube
  assert.equal(withPlayback(SONGS[0]).playback.youtube, false); // sample songs are not on YouTube
});

test('YouTube: picks the official video, remembers it, and re-checks after 30 days', async () => {
  clearYouTubeMemory();
  youtube.calls.length = 0;
  const first = await videoFor({ title: '富士山下', artist: '陳奕迅' });
  assert.equal(first.video_id, 'official1'); // not the fan cover
  assert.equal(first.source, 'search');
  assert.deepEqual(youtube.calls, ['search:snippet', 'videos:status,snippet']);

  youtube.calls.length = 0;
  const again = await videoFor({ title: '富士山下', artist: '陳奕迅' });
  assert.equal(again.source, 'saved');
  assert.deepEqual(youtube.calls, []); // no quota used

  mock.timers.enable({ apis: ['Date'], now: Date.now() + 31 * 24 * 60 * 60 * 1000 });
  try {
    const later = await videoFor({ title: '富士山下', artist: '陳奕迅' });
    assert.equal(later.source, 'rechecked');
    assert.deepEqual(youtube.calls, ['videos:status']); // a cheap check, not a new search
  } finally {
    mock.timers.reset();
  }
});

test('YouTube: daily limit reached is explained', async () => {
  clearYouTubeMemory();
  youtube.quota = true;
  const res = await fetch(`${baseUrl}/api/music/youtube?title=Some&artist=One`);
  youtube.quota = false;
  assert.equal(res.status, 503);
  assert.match((await res.json()).error.message, /daily limit/);
});

test('YouTube lookups are validated; sample songs have no video', async () => {
  assert.equal((await fetch(`${baseUrl}/api/music/youtube`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/music/youtube?title=Only`)).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/music/youtube?song_id=static-lullaby`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/music/youtube?song_id=no-such-song`)).status, 404);
});

test('Deezer audio for catalogue songs redirects to a fresh preview', async () => {
  assert.equal((await fetch(`${baseUrl}/api/audio/deezer/abc`)).status, 400);
  // Not in the catalogue (this test server has no imported Deezer songs).
  assert.equal((await fetch(`${baseUrl}/api/audio/deezer/101`, { redirect: 'manual' })).status, 404);
});

test('profiles and sessions accept only known languages', async () => {
  const post = (body) => fetch(`${baseUrl}/api/recommendations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ profile: { ...profile, languages: ['klingon'] } })).status, 400);
  assert.equal((await post({ profile: { ...profile, languages: ['yue', 'yue'] } })).status, 400);
  const ok = await (await post({ profile: { ...profile, languages: ['ms'] } })).json();
  assert.deepEqual(ok.meta.languages, ['ms']);
  assert.equal(ok.meta.instrumental_fill, true); // the built-in catalogue has no Malay songs
});

test('Discover lists languages and search filters by language', async () => {
  const discover = await (await fetch(`${baseUrl}/api/songs/discover`)).json();
  assert.deepEqual(discover.languages.map((item) => item.id), ['en', 'ms', 'zh', 'yue', 'nan', 'ko', 'ja', 'instrumental', 'other']);
  assert.equal(discover.languages.find((item) => item.id === 'instrumental').count, 70);
  const malay = await (await fetch(`${baseUrl}/api/songs?language=ms`)).json();
  assert.equal(malay.count, 0);
  assert.equal((await fetch(`${baseUrl}/api/songs?language=xx`)).status, 400);
});

test('the import reports which searches it tried', async () => {
  const progress = [];
  await importDeezerCatalog({ perMood: 10, languages: ['yue'], onProgress: (event) => progress.push(event) });
  const sad = progress.find((event) => event.mood === 'sad');
  assert.deepEqual(sad.tried.map((attempt) => attempt.query).slice(0, 3), ['粤语 伤感', '廣東歌 傷感', 'cantopop sad']);
  assert.equal(sad.tried[2].playlists, 1);
  const lonely = progress.find((event) => event.mood === 'lonely');
  assert.equal(lonely.found, 0);
  assert.ok(lonely.tried.length >= 3);
});

test('without a limit, whole playlists are read page by page', async () => {
  const { songs } = await importDeezerCatalog({ languages: ['ko'] });
  // The pretend Korean playlist has 2 songs; the Japanese one is labelled Japanese.
  assert.deepEqual(songs.map((item) => [item.id, item.language]), [['deezer-201', 'ko'], ['deezer-202', 'ja']]);
});

test('the Deezer import: an artist known from Western music with a Latin title is English', async () => {
  const { songs, changes } = await importDeezerCatalog({ languages: ['ko'], westernArtists: ['bts'] });
  assert.equal(songs.find((item) => item.id === 'deezer-201').language, 'en');
  assert.ok(changes.some((change) => change.from === 'ko' && change.to === 'en'));
});
