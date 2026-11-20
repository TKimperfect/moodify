// MTG-Jamendo and MuSe: reading the files, translating moods, importing
// (with pretend Jamendo and Deezer servers), and reading many songs from Supabase.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const TSV = [
  'TRACK_ID\tARTIST_ID\tALBUM_ID\tPATH\tDURATION\tTAGS',
  'track_0000948\tartist_000087\talbum_000149\t48/948.mp3\t212.7\tmood/theme---melancholic\tmood/theme---slow',
  'track_0000950\tartist_000087\talbum_000149\t50/950.mp3\t248.0\tmood/theme---happy\tmood/theme---party\tmood/theme---fun',
  'track_0000951\tartist_000087\talbum_000149\t51/951.mp3\t199.7\tmood/theme---film',
  'track_0002165\tartist_000326\talbum_000347\t65/2165.mp3\t229.0\tmood/theme---dark\tmood/theme---energetic',
  'track_0002263\tartist_000320\talbum_000366\t63/2263.mp3\t494.7\tmood/theme---melancholic',
].join('\n');

const jamendoRequests = [];
let refuseBigBatches = false;
let deezerDown = false;
const deezerQueries = [];
let songRows = [];
let songsTimeouts = 0;
const fake = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/v3.0/tracks/') {
    jamendoRequests.push(req.url);
    const ids = url.searchParams.get('id').split('+');
    if (refuseBigBatches && ids.length > 2) return json(200, { headers: { status: 'failed', code: 3, error_message: 'Too many values for parameter id' }, results: [] });
    const results = ids
      .filter((id) => id !== '2263') // removed from Jamendo since the dataset was made
      .map((id) => ({
        id, name: `Song ${id}`, artist_name: `Artist ${id}`, duration: 200, audio: `https://prod-1.storage.jamendo.com/?trackid=${id}&format=mp32`,
        shareurl: `https://www.jamendo.com/track/${id}`, license_ccurl: 'http://creativecommons.org/licenses/by-nc/3.0/', album_image: '', releasedate: '2015-01-01',
        // Jamendo's own tags say "happy": MTG's human tags must win.
        musicinfo: { vocalinstrumental: 'instrumental', speed: 'high', tags: { genres: ['pop'], vartags: ['happy'] } },
      }));
    return json(200, { headers: { status: 'success' }, results });
  }
  if (url.pathname === '/search') {
    const q = url.searchParams.get('q');
    deezerQueries.push(q);
    if (deezerDown) return json(200, { error: { type: 'Exception', message: 'Service temporarily unavailable', code: 100 } });
    // Plain searches only (the advanced syntax finds nothing for this band).
    if (q === 'Plain Band Plain Song') return json(200, { data: [{ id: 7, title: 'Plain Song', artist: { name: 'Plain Band' }, rank: 1000 }] });
    if (q.includes('Adele')) return json(200, { data: [{ id: 1, title: 'Someone Else', artist: { name: 'Other' } }, { id: 2, title: 'Someone Like You', artist: { name: 'Adele' }, rank: 900000, album: { title: '21', cover_medium: 'https://c/21.jpg' }, link: 'https://www.deezer.com/track/2', duration: 285 }] });
    if (q.includes('Metallica')) return json(200, { data: [{ id: 3, title: 'Battery (Remastered)', artist: { name: 'Metallica' }, rank: 700000 }] });
    return json(200, { data: [] });
  }
  if (url.pathname === '/rest/v1/songs') {
    // Supabase (PostgREST): id filters such as id=gt.x / id=gte.x / id=lt.y,
    // order=id, offset/limit or a Range header; at most 1000 rows per reply.
    if (songsTimeouts > 0) {
      songsTimeouts -= 1;
      return json(500, { code: '57014', message: 'canceling statement due to statement timeout' });
    }
    const filters = url.searchParams.getAll('id').map((filter) => /^(gt|gte|lt)\.(.*)$/.exec(filter)).filter(Boolean);
    const test = { gt: (id, value) => id > value, gte: (id, value) => id >= value, lt: (id, value) => id < value };
    const rows = [...songRows].sort((x, y) => (x.id < y.id ? -1 : 1)).filter((row) => filters.every(([, op, value]) => test[op](row.id, value)));
    const range = /(\d+)-(\d+)/.exec(req.headers.range ?? '');
    const offset = Number(url.searchParams.get('offset') ?? range?.[1] ?? 0);
    const limit = Math.min(1000, Number(url.searchParams.get('limit') ?? (range ? Number(range[2]) - Number(range[1]) + 1 : 1000)));
    // "Prefer: count=exact" asks for the total, sent back in Content-Range.
    if (/count=exact/.test(req.headers.prefer ?? '')) res.setHeader('Content-Range', `${offset}-${offset + limit - 1}/${rows.length}`);
    return json(200, rows.slice(offset, offset + limit));
  }
  json(404, {});
});

const MUSE_ZENODO = [
  'lastfm_url,track,artist,seeds,valence_tags,arousal_tags,dominance_tags,mbid,spotify_id',
  `https://last.fm/a,Someone Like You,Adele,"['sad', 'melancholy']",2.9,3.1,4.0,,`,
  `https://last.fm/b,Battery,Metallica,"['aggressive']",3.2,6.4,6.1,,`,
  `https://last.fm/c,"Hello, Goodbye",The Beatles,"['happy']",7.4,5.2,5.9,,`,
  `https://last.fm/d,Nowhere,Unknown Band,['bored'],5.0,3.5,4.0,,`,
].join('\n');
const MUSE_KAGGLE = 'track,artist,seeds,number_of_emotion_tags,valence_tags,arousal_tags,dominance_tags,mbid,spotify_id,genre\nX,Y,"[\'calm\']",12,6.5,2.0,5.0,,,pop\n';

let mtg;
let muse;
let datasetImport;
let explain;
let mergeSongs;
before(async () => {
  await new Promise((resolve) => fake.listen(0, resolve));
  const base = `http://127.0.0.1:${fake.address().port}`;
  Object.assign(process.env, {
    JAMENDO_CLIENT_ID: 'test-client', JAMENDO_API_BASE: base, DEEZER_API_BASE: base, DEEZER_REQUEST_GAP_MS: '0',
    SUPABASE_URL: base, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test', SUPABASE_SECRET_KEY: '',
  });
  mtg = await import('../src/services/music/datasets/mtgJamendo.js');
  muse = await import('../src/services/music/datasets/muse.js');
  datasetImport = await import('../src/services/music/datasetImport.js');
  ({ explain } = await import('../src/services/recommendation/explain.js'));
  ({ mergeSongs } = await import('../src/repositories/song.repository.js'));
});
after(() => fake.close());

test('MTG-Jamendo file: ids and tags are read from the real format', () => {
  const rows = mtg.parseMtgTsv(TSV);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { id: 948, duration: 212.7, tags: ['melancholic', 'slow'] });
  assert.deepEqual(rows[1].tags, ['happy', 'party', 'fun']);
});

test('MTG tags become MOODIFY moods; use-only tags are ignored', () => {
  assert.deepEqual(mtg.moodsFromTags(['melancholic', 'slow']).moods.sort(), ['lonely', 'sad']);
  const party = mtg.moodsFromTags(['happy', 'party', 'fun']);
  assert.deepEqual(party.moods, ['happy']);
  assert.equal(party.energy, 78);
  assert.ok(party.effects.includes('energize'));
  assert.equal(mtg.moodsFromTags(['film', 'advertising']), null);
  assert.ok(mtg.moodsFromTags(['dark', 'energetic']).moods.includes('angry'));
  assert.ok(mtg.moodsFromTags(['relaxing', 'calm']).effects.includes('comfort'));
});

test('MTG import: details from Jamendo in batches, human tags win, removed songs skipped', async () => {
  jamendoRequests.length = 0;
  const songs = await datasetImport.importMtgJamendo({ perMood: 10, tsvText: TSV });
  assert.deepEqual(songs.map((song) => song.id).sort(), ['jamendo-2165', 'jamendo-948', 'jamendo-950']);
  const sad = songs.find((song) => song.id === 'jamendo-948');
  assert.deepEqual(sad.moods.sort(), ['lonely', 'sad']); // not Jamendo's "happy"
  assert.equal(sad.mood_source, 'mtg-jamendo');
  assert.equal(sad.language, 'instrumental');
  assert.ok(sad.energy <= 30); // "slow"
  assert.equal(sad.preview_url, 'https://prod-1.storage.jamendo.com/?trackid=948&format=mp32');
  assert.equal(jamendoRequests.length, 1); // one request for all of them
  assert.match(jamendoRequests[0], /id=[0-9]+%2B[0-9]+/); // "+" sent as %2B, as Jamendo requires
});

test('MuSe file: both the Zenodo and the Kaggle layouts are read', () => {
  const rows = muse.readMuse(MUSE_ZENODO);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0].seeds, ['sad', 'melancholy']);
  assert.equal(rows[2].track, 'Hello, Goodbye'); // comma inside quotes
  assert.equal(muse.readMuse(MUSE_KAGGLE)[0].tagCount, 12);
  assert.throws(() => muse.readMuse('a,b\n1,2'), /does not look like the MuSe dataset/);
});

test('MuSe scores become moods, energy and intensity', () => {
  const [sad, metal, happy, bored] = muse.readMuse(MUSE_ZENODO).map(muse.moodsFromMuse);
  assert.equal(sad.moods[0], 'sad');
  assert.ok(sad.energy < 50);
  assert.ok(metal.moods.includes('angry'));
  assert.ok(metal.energy > 80);
  assert.equal(happy.moods[0], 'happy');
  assert.equal(bored.moods[0], 'empty');
});

test('MuSe import: finds the right song on Deezer and skips mismatches', async () => {
  deezerQueries.length = 0;
  const songs = await datasetImport.importMuse({ perMood: 5, csvText: MUSE_ZENODO });
  const adele = songs.find((song) => song.artist === 'Adele');
  assert.equal(adele.id, 'deezer-2'); // not the first, wrong result
  assert.equal(adele.mood_source, 'muse');
  assert.equal(adele.language, 'en');
  assert.equal(adele.moods[0], 'sad');
  assert.ok(songs.some((song) => song.id === 'deezer-3')); // "Battery (Remastered)" still matches "Battery"
  assert.ok(!songs.some((song) => song.artist === 'The Beatles')); // not on (pretend) Deezer
  assert.match(deezerQueries[0], /^artist:".+" track:".+"$/);
  assert.ok(deezerQueries.includes('The Beatles Hello, Goodbye')); // plain search tried after the advanced one
});

test('later sources win: dataset moods replace earlier guesses', () => {
  const guess = { id: 'jamendo-948', moods: ['happy'], mood_source: 'estimated' };
  const tagged = { id: 'jamendo-948', moods: ['sad'], mood_source: 'mtg-jamendo' };
  const merged = mergeSongs([guess], [tagged]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].moods, ['sad']);
});

test('recommendation reasons name the dataset behind the mood', () => {
  const profile = { moods: ['sad'], energy: 30, intensity: 60, genres: [], desired_effect: 'comfort', tempo: 'any' };
  const song = { moods: ['sad'], effects: ['comfort'], genres: ['pop'], tempo: 'slow', bpm: 70, energy: 30, mood_source: 'muse' };
  const parts = { mood: 1, effect: 1, genre: 0.5, tempo_energy: 0.9, history: 0.5 };
  assert.ok(explain(profile, song, parts).includes("Mood measured from listeners' tags (MuSe dataset)."));
  assert.ok(explain(profile, { ...song, mood_source: 'mtg-jamendo' }, parts).includes('Mood tagged by people in the MTG-Jamendo dataset.'));
});

test('more than 1000 songs in Supabase are all read (page by page, by id)', async () => {
  songRows = Array.from({ length: 2500 }, (_, i) => ({
    // ids on both sides of the slice borders ("deezer-2", "deezer-4"…)
    id: i % 2 ? `deezer-${(i * 7919) % 100000}` : `s-${String(i).padStart(5, '0')}`, title: `T${i}`, artist: `A${i}`, genres: ['pop'], moods: ['sad'], effects: ['comfort'],
    energy: 30, intensity: 50, bpm: 80, tempo: 'slow', popularity: 10, year: 2020, provider: 'sample',
  }));
  songsTimeouts = 2; // statement timeouts: the page is tried again (after a wait, with fewer rows)
  const { songRepository } = await import('../src/repositories/song.repository.js');
  const status = await songRepository.status({ fresh: true });
  assert.equal(status.source, 'supabase');
  assert.equal(status.songs, 2500);
  const ids = new Set((await songRepository.findAll()).map((song) => song.id));
  assert.equal(ids.size, 2500); // each song once
});

test('if Jamendo refuses a batch, the import splits it and still finishes', async () => {
  refuseBigBatches = true;
  jamendoRequests.length = 0;
  const notes = [];
  try {
    const songs = await datasetImport.importMtgJamendo({ perMood: 10, tsvText: TSV, onProgress: (event) => event.step === 'retry' && notes.push(event.reason) });
    assert.deepEqual(songs.map((song) => song.id).sort(), ['jamendo-2165', 'jamendo-948', 'jamendo-950']);
    assert.ok(jamendoRequests.length > 1);
    assert.match(notes[0], /Too many values for parameter id/); // Jamendo's own reason is shown
  } finally {
    refuseBigBatches = false;
  }
});

test('MuSe import can stop and continue where it left off', async () => {
  const progress = new Map();
  let calls = 0;
  // First run: stop after the first song.
  await datasetImport.importMuse({ csvText: MUSE_ZENODO, progress, shouldStop: () => calls++ >= 1 });
  const afterFirst = progress.size;
  assert.equal(afterFirst, 1);
  // Second run: the checked song is skipped, the rest are done.
  deezerQueries.length = 0;
  const songs = await datasetImport.importMuse({ csvText: MUSE_ZENODO, progress });
  assert.equal(progress.size, 4); // all four checked (found or not)
  assert.ok(!deezerQueries.some((q) => q.includes('Adele'))); // the song checked before was skipped
  assert.ok(songs.some((song) => song.artist === 'Adele'));
});

test('MuSe lookups explain misses: no results, wrong names, plain-search fallback', async () => {
  const { findOnDeezer } = datasetImport;
  assert.equal((await findOnDeezer({ artist: 'Plain Band', track: 'Plain Song' })).track.id, 7);
  const none = await findOnDeezer({ artist: 'Nobody', track: 'Nothing' });
  assert.equal(none.reason, 'no-results');
  const wrong = await findOnDeezer({ artist: 'Adele', track: 'Rolling in the Deep' });
  assert.equal(wrong.reason, 'mismatch');
  assert.match(wrong.detail, /MuSe "Adele – Rolling in the Deep" vs Deezer/);
});

test('MuSe import: errors are not marked as checked, and many errors in a row stop the run', async () => {
  deezerDown = true;
  const progress = new Map();
  const events = [];
  try {
    const many = [MUSE_ZENODO.split('\n')[0], ...Array.from({ length: 30 }, (_, i) => `u,Song ${i},Band ${i},"['sad']",3,3,4,,`)].join('\n');
    const songs = await datasetImport.importMuse({ csvText: many, progress, onProgress: (event) => events.push(event) });
    assert.equal(songs.length, 0);
    assert.equal(progress.size, 0); // nothing marked: they are retried next time
    const stopped = events.find((event) => event.step === 'stopped');
    assert.match(stopped.reason, /Service temporarily unavailable/);
    assert.ok(stopped.stats.error >= 20);
  } finally {
    deezerDown = false;
  }
});

test('MuSe: candidates take turns between moods, so a stopped run covers every mood', async () => {
  const { pickMuse } = await import('../src/services/music/datasets/muse.js');
  const row = (n, seeds, valence, arousal) => ({ artist: `A${n}`, title: `T${n}`, seeds, tagCount: 1, valence, arousal, dominance: 5 });
  const rows = [
    row(1, ['energetic'], 7, 7), row(2, ['energetic'], 7, 7), row(3, ['energetic'], 7, 7),
    row(4, ['sad'], 2, 3), row(5, ['sad'], 2, 3),
  ];
  const picked = pickMuse(rows, Infinity);
  const firstTwo = new Set(picked.slice(0, 2).map((r) => r.mood.moods[0]));
  assert.equal(picked.length, 5);
  assert.equal(firstTwo.size, 2);
});

test('Clean-up: only old Deezer playlist songs that nobody used are removed', async () => {
  const { staleSongIds } = await import('../src/services/music/prune.js');
  const rows = [
    { id: 'deezer-1', provider: 'deezer', mood_source: 'playlist' }, // still imported
    { id: 'deezer-2', provider: 'deezer', mood_source: 'playlist' }, // old, unused
    { id: 'deezer-3', provider: 'deezer', mood_source: 'playlist' }, // old, in someone's favourites
    { id: 'deezer-4', provider: 'deezer', mood_source: 'muse' }, // from MuSe, not this import
    { id: 'jamendo-5', provider: 'jamendo', mood_source: null },
  ];
  assert.deepEqual(staleSongIds(rows, ['deezer-1'], ['deezer-3']), ['deezer-2']);
  // With the MuSe file read, MuSe songs it no longer offers go too.
  assert.deepEqual(staleSongIds(rows, ['deezer-1'], ['deezer-3'], { sources: ['playlist', 'muse'] }), ['deezer-2', 'deezer-4']);
});

test('MuSe without mood words (the real Zenodo file): the three scores give all ten moods', async () => {
  const { readMuse, moodFromScores, scoreCuts, pickMuse } = await import('../src/services/music/datasets/muse.js');
  const header = 'id,track,artist,valence_tags,arousal_tags,dominance_tags,mbid,spotify_id';
  const rows = readMuse([header, "0,'Till I Collapse,Eminem,4.55,5.27,5.69,x,y"].join('\n'));
  assert.deepEqual(rows[0].seeds, []);
  const cuts = { valence: [4, 6], arousal: [3.5, 5], dominance: 5 };
  const mood = (valence, arousal, dominance) => moodFromScores({ valence, arousal, dominance }, cuts);
  assert.equal(mood(7, 6, 5), 'happy');
  assert.equal(mood(7, 4, 5), 'romantic');
  assert.equal(mood(7, 2, 5), 'calm');
  assert.equal(mood(5, 4, 5), 'nostalgic');
  assert.equal(mood(5, 6, 5), 'motivated');
  assert.equal(mood(3, 6, 6), 'angry');
  assert.equal(mood(3, 6, 4), 'anxious');
  assert.equal(mood(3, 4, 4), 'lonely');
  assert.equal(mood(3, 4, 6), 'sad');
  assert.equal(mood(3, 2, 4), 'empty');
  // Thirds measured on the file itself, so every mood gets songs.
  const many = [];
  for (let v = 1; v <= 8; v += 0.5) for (let a = 1; a <= 7; a += 0.5) for (const d of [3, 7]) many.push({ track: `${v}${a}${d}`, artist: 'A', seeds: [], valence: v, arousal: a, dominance: d, tagCount: 1 });
  assert.ok(scoreCuts(many).valence[0] > 3);
  const moods = new Set(pickMuse(many, Infinity).map((row) => row.mood.moods[0]));
  assert.equal(moods.size, 10);
});

test('MuSe import: songs found in an earlier run get the current mood rules', async () => {
  const header = 'id,track,artist,valence_tags,arousal_tags,dominance_tags,mbid,spotify_id';
  const csvText = [header, '0,Someone Like You,Adele,7.4,5.9,5.9,,'].join('\n');
  const old = { id: 'deezer-2', title: 'Someone Like You', artist: 'Adele', moods: ['sad'], energy: 10 };
  const progress = new Map([['adele|someone like you', old]]);
  const songs = await datasetImport.importMuse({ csvText, progress });
  assert.equal(songs.length, 1);
  assert.equal(songs[0].id, 'deezer-2'); // not looked up again
  assert.equal(songs[0].moods[0], 'happy');
});

test('MuSe: angry and sad songs exist even when dominance rises with valence', async () => {
  const { pickMuse } = await import('../src/services/music/datasets/muse.js');
  const rows = [];
  let n = 0;
  for (let v = 1; v <= 8; v += 0.25) for (let a = 1; a <= 7; a += 0.5) for (const spread of [-0.4, 0.4]) {
    n += 1;
    rows.push({ track: `t${n}`, artist: 'A', seeds: [], valence: v, arousal: a, dominance: 1 + v * 0.8 + spread, tagCount: 1 });
  }
  const counts = {};
  for (const row of pickMuse(rows, Infinity)) counts[row.mood.moods[0]] = (counts[row.mood.moods[0]] ?? 0) + 1;
  assert.ok(counts.angry > counts.anxious * 0.5, JSON.stringify(counts));
  assert.ok(counts.sad > 0);
});

test('language labels: artists, playlists and MuSe decide together', async () => {
  const { relabel } = await import('../scripts/languageLabels.js');
  const song = (id, title, artist, language, extra = {}) => ({ id, title, artist, language, ...extra });
  const deezer = [
    song('deezer-1', '稻香', 'Jay Chou', 'zh'),
    song('deezer-2', 'Mojito', 'Jay Chou', 'zh'), // same artist as a Chinese title
    song('deezer-3', 'Give Me Everything', 'Pitbull', 'zh'), // known from MuSe
    song('deezer-4', 'Hype Boy', 'NewJeans', 'ko', { isrc: 'USA2P2230222' }), // HYBE's US label: Korean
    song('deezer-5', 'Clint Eastwood', 'Gorillaz', 'ja'),
  ];
  const muse = [song('deezer-5', 'Clint Eastwood', 'Gorillaz', 'en'), song('deezer-9', 'Hey Ya!', 'Pitbull', 'en')];
  const result = relabel({ deezer, muse });
  const language = (id) => [...result.deezer, ...result.muse].find((item) => item.id === id).language;
  assert.equal(language('deezer-1'), 'zh');
  assert.equal(language('deezer-2'), 'zh');
  assert.equal(language('deezer-3'), 'en');
  assert.equal(language('deezer-4'), 'ko');
  assert.equal(language('deezer-5'), 'en');
  assert.equal(result.deezer.length, 4); // the MuSe copy of deezer-5 is the one kept
  assert.deepEqual(result.deezer[0].found_in, ['zh']);
});
