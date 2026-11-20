// The "song repository": the only place that knows WHERE songs are stored.
//   - Supabase configured and reachable  -> songs come from the database
//   - otherwise                          -> the built-in sample songs, plus any
//                                           songs imported with "npm run music:import"
// So MOODIFY keeps working with no database at all.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SONGS as SAMPLE_SONGS } from '../data/songs.js';
import { MOOD_IDS, EFFECT_IDS, GENRE_IDS, SONG_LANGUAGE_IDS, currentLanguage } from '../data/taxonomy.js';
import { getPublicClient, isSupabaseConfigured } from '../lib/supabase.js';
import { withPlayback } from '../services/music/music.service.js';

// The whole catalogue (100,000+ songs, about 70 MB) is read when the server
// starts and then every 6 hours, in the background. Songs only change when you
// run an import, so reading more often would just use up Supabase's free
// monthly data allowance. SONGS_CACHE_MINUTES in server/.env changes it.
const CACHE_MS = Math.max(1, Number(process.env.SONGS_CACHE_MINUTES) || 360) * 60_000;
const RETRY_MS = 60_000;
const BASE_COLUMNS = 'id,title,artist,genres,moods,effects,energy,intensity,bpm,tempo,popularity,year,provider,external_url,preview_url';
const MUSIC_COLUMNS = `${BASE_COLUMNS},artwork_url,album,duration_s,license_url`;
const LANGUAGE_COLUMNS = `${MUSIC_COLUMNS},language,youtube_id,youtube_checked_at,mood_source`;
// Newest first; older databases (migrations not run yet) fall back step by step.
const COLUMN_SETS = [LANGUAGE_COLUMNS, MUSIC_COLUMNS, BASE_COLUMNS];
const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(here, '..', '..', 'data');
// Later files win when the same song appears twice: the research datasets
// (MTG-Jamendo, MuSe) have better mood information than the earlier guesses.
export const IMPORTED_FILES = ['jamendo-catalog.json', 'deezer-catalog.json', 'mtg-catalog.json', 'muse-catalog.json'].map((name) =>
  path.join(DATA_DIR, name),
);

const isText = (value) => typeof value === 'string' && value.length > 0;
const isLevel = (value) => Number.isInteger(value) && value >= 0 && value <= 100;
const subsetOf = (list, allowed) => Array.isArray(list) && list.length > 0 && list.every((item) => allowed.includes(item));

// Checks one imported song so a damaged file cannot break the app.
function isValidImported(song) {
  return (
    song &&
    /^[a-z0-9-]{1,80}$/.test(song.id) &&
    isText(song.title) &&
    isText(song.artist) &&
    subsetOf(song.genres, GENRE_IDS) &&
    subsetOf(song.moods, MOOD_IDS) &&
    subsetOf(song.effects, EFFECT_IDS) &&
    isLevel(song.energy) &&
    isLevel(song.intensity) &&
    Number.isInteger(song.bpm) &&
    ['slow', 'medium', 'fast'].includes(song.tempo) &&
    (song.language === undefined || song.language === null || SONG_LANGUAGE_IDS.includes(song.language)) &&
    (song.preview_url === null || /^https:\/\//.test(song.preview_url))
  );
}

export function loadImportedSongs(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return []; // no file yet (or unreadable): just the sample songs
  }
  const songs = Array.isArray(parsed?.songs)
    ? parsed.songs.map((song) => (song?.language ? { ...song, language: currentLanguage(song.language) } : song)).filter(isValidImported)
    : [];
  if (Array.isArray(parsed?.songs) && songs.length < parsed.songs.length) {
    console.warn(`[songs] Ignored ${parsed.songs.length - songs.length} damaged entries in ${path.basename(file)}`);
  }
  // Songs whose language could not be found out are not offered (since 1.2.22).
  return songs.filter((song) => song.language !== 'unknown');
}

// Joins song lists; when a song appears more than once, the later list wins.
export function mergeSongs(...lists) {
  const byId = new Map();
  for (const song of lists.flat()) byId.set(song.id, song);
  return [...byId.values()];
}

function localCatalogue() {
  return mergeSongs(SAMPLE_SONGS, ...IMPORTED_FILES.map((file) => loadImportedSongs(file))).map(withPlayback);
}

// Makes a database row look exactly like a song from the sample file.
export function toSong(row) {
  return withPlayback({
    id: row.id,
    title: row.title,
    artist: row.artist,
    genres: row.genres,
    moods: row.moods,
    effects: row.effects,
    energy: row.energy,
    intensity: row.intensity,
    bpm: row.bpm,
    tempo: row.tempo,
    popularity: row.popularity,
    year: row.year,
    provider: row.provider ?? 'sample',
    external_url: row.external_url ?? null,
    preview_url: row.preview_url ?? null,
    artwork_url: row.artwork_url ?? null,
    album: row.album ?? null,
    duration_s: row.duration_s ?? null,
    license_url: row.license_url ?? null,
    language: currentLanguage(row.language ?? (row.provider === 'sample' || !row.provider ? 'instrumental' : null)),
    youtube_id: row.youtube_id ?? null,
    youtube_checked_at: row.youtube_checked_at ?? null,
    mood_source: row.mood_source ?? null,
  });
}

let LOCAL = localCatalogue();
let cache = { songs: LOCAL, source: 'local', loadedAt: 0, problem: null, note: null };

// Supabase returns at most 1000 rows per request, so read page by page.
// Each page asks for "the next rows after the last id read" (keyset
// paging): the database finds them straight from the id index, however far
// into the table. Paging by row number ("skip 99,000 rows") and counting all
// rows get slower the bigger the table is.
// The id range is split into slices (ids look like "deezer-3135553"); a few
// slices are read at a time, so the small free database is not swamped.
// Supabase stops any request that takes more than a few seconds (statement
// timeout): such a page is tried again after a short wait, with fewer rows.
const PAGE = 500;
const MIN_PAGE = 100;
const MAX_SONGS = 200_000;
const SLICES = [null, 'deezer-1', 'deezer-2', 'deezer-3', 'deezer-4', 'deezer-5', 'deezer-6', 'deezer-7', 'deezer-8', 'deezer-9', 'e'];
const AT_ONCE = 3;
const WAITS_MS = [1000, 3000, 6000]; // before the 2nd, 3rd and 4th try of a page
const TIMEOUT = '57014'; // Postgres: statement timeout
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Worth another try: a timeout, an overloaded server, or no answer at all.
const passing = (error) => error && (error.code === TIMEOUT || /timeout|fetch failed|network|ECONN|503|502|504/i.test(`${error.code} ${error.message}`));

async function readSlice(columns, from, to) {
  const rows = [];
  let after = null;
  let size = PAGE;
  for (;;) {
    const next = () => {
      let query = getPublicClient().from('songs').select(columns);
      if (after !== null) query = query.gt('id', after);
      else if (from !== null) query = query.gte('id', from);
      if (to !== null) query = query.lt('id', to);
      return query.order('id').limit(size);
    };
    let result = await next();
    for (const wait of WAITS_MS) {
      if (!passing(result.error)) break;
      size = Math.max(MIN_PAGE, Math.floor(size / 2));
      await pause(wait);
      result = await next();
    }
    if (result.error) return { data: null, error: result.error };
    rows.push(...result.data);
    if (result.data.length < size || rows.length >= MAX_SONGS) return { data: rows, error: null };
    after = result.data.at(-1).id;
  }
}

async function selectSongs(columns) {
  const results = [];
  for (let i = 0; i < SLICES.length; i += AT_ONCE) {
    const batch = SLICES.slice(i, i + AT_ONCE).map((from, index) => readSlice(columns, from, SLICES[i + index + 1] ?? null));
    const done = await Promise.all(batch);
    const failed = done.find((result) => result.error);
    if (failed) return { data: null, error: failed.error };
    results.push(...done);
  }
  // Each song once, even if slices were to overlap.
  const byId = new Map(results.flatMap((result) => result.data).map((row) => [row.id, row]));
  return { data: [...byId.values()].slice(0, MAX_SONGS), error: null };
}

let loading = null;
async function load({ wait = false } = {}) {
  if (!isSupabaseConfigured) return cache;
  if (cache.loadedAt && Date.now() - cache.loadedAt < CACHE_MS) return cache;
  // One read at a time, however many requests arrive meanwhile.
  loading ??= readDatabase().finally(() => {
    loading = null;
  });
  // Songs already read from the database keep being used while the new copy
  // loads; after a failed read, the sample songs answer while it tries again.
  if ((cache.source === 'supabase' || cache.problem) && !wait) return cache;
  return loading;
}

async function readDatabase() {
  let problem = null;
  try {
    let note = null;
    let data;
    let error;
    for (const [index, columns] of COLUMN_SETS.entries()) {
      ({ data, error } = await selectSongs(columns));
      if (error?.code !== '42703') break;
      // A migration has not been run yet: try the older set of columns.
      note = index === 0
        ? 'Run supabase/migrations/003_languages_youtube.sql to enable song languages and YouTube'
        : 'Run supabase/migrations/002_music_sources.sql and 003_languages_youtube.sql';
    }
    if (error) problem = `Database error: ${error.message}`;
    else if (data.length === 0) problem = 'The songs table is empty (run: npm run db:seed)';
    else {
      cache = { songs: data.map(toSong), source: 'supabase', loadedAt: Date.now(), problem: null, note };
      return cache;
    }
  } catch (error) {
    problem = `Cannot reach the database: ${error.message}`;
  }

  if (cache.source === 'supabase' && !/is empty/.test(problem)) {
    // The database could not be read this time: keep the songs we have and
    // try again in a minute.
    console.warn(`[songs] ${problem}. Keeping the songs already loaded.`);
    cache = { ...cache, problem, loadedAt: Date.now() - CACHE_MS + RETRY_MS };
    return cache;
  }
  if (cache.problem !== problem) console.warn(`[songs] ${problem}. Using built-in sample songs for now; trying again in a minute.`);
  // Try the database again in a minute, not only after the usual 6 hours.
  cache = { songs: LOCAL, source: 'local', loadedAt: Date.now() - CACHE_MS + RETRY_MS, problem, note: null };
  return cache;
}

// A lookup table per loaded catalogue (fast even with many songs).
const lookups = new WeakMap();
function byIdFor(loaded) {
  let table = lookups.get(loaded.songs);
  if (!table) {
    table = new Map(loaded.songs.map((song) => [song.id, song]));
    lookups.set(loaded.songs, table);
  }
  return table;
}

// Songs per language and provider, counted once per loaded catalogue (Render
// asks /api/health every few seconds, and counting 100,000 songs each time
// would keep the small free server busy).
const counted = new WeakMap();
function countsFor(songs) {
  let result = counted.get(songs);
  if (!result) {
    const byLanguage = {};
    const byProvider = {};
    for (const song of songs) {
      const language = song.language ?? 'unknown';
      const provider = song.provider ?? 'sample';
      byLanguage[language] = (byLanguage[language] ?? 0) + 1;
      byProvider[provider] = (byProvider[provider] ?? 0) + 1;
    }
    result = { by_language: byLanguage, by_provider: byProvider };
    counted.set(songs, result);
  }
  return result;
}

export const songRepository = {
  async findAll() {
    return (await load()).songs;
  },

  async findById(id) {
    return byIdFor(await load()).get(id) ?? null;
  },

  async findByIds(ids) {
    const byId = byIdFor(await load());
    return ids.map((id) => byId.get(id)).filter(Boolean);
  },

  // Used by the health check.
  async status({ fresh = false } = {}) {
    if (fresh) cache.loadedAt = 0;
    const { songs, source, problem, note } = await load({ wait: fresh });
    return {
      configured: isSupabaseConfigured,
      source,
      songs: songs.length,
      ...countsFor(songs),
      problem: problem ?? note,
    };
  },

  usesDatabase() {
    return cache.source === 'supabase';
  },

  // Re-reads the imported songs files (used by tests).
  reloadLocal() {
    LOCAL = localCatalogue();
    cache = { songs: LOCAL, source: 'local', loadedAt: 0, problem: null, note: null };
  },
};
