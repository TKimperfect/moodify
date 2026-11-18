// The "song repository": the only place that knows WHERE songs are stored.
//   - Supabase configured and reachable  -> songs come from the database
//   - otherwise                          -> the built-in sample songs, plus any
//                                           songs imported with "npm run music:import"
// So MOODIFY keeps working with no database at all.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SONGS as SAMPLE_SONGS } from '../data/songs.js';
import { MOOD_IDS, EFFECT_IDS, GENRE_IDS } from '../data/taxonomy.js';
import { getPublicClient, isSupabaseConfigured } from '../lib/supabase.js';
import { withPlayback } from '../services/music/music.service.js';

const CACHE_MS = 60_000;
const BASE_COLUMNS = 'id,title,artist,genres,moods,effects,energy,intensity,bpm,tempo,popularity,year,provider,external_url,preview_url';
const MUSIC_COLUMNS = `${BASE_COLUMNS},artwork_url,album,duration_s,license_url`;
const here = path.dirname(fileURLToPath(import.meta.url));
export const IMPORTED_FILE = path.join(here, '..', '..', 'data', 'jamendo-catalog.json');

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
    (song.preview_url === null || /^https:\/\//.test(song.preview_url))
  );
}

export function loadImportedSongs(file = IMPORTED_FILE) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return []; // no file yet (or unreadable): just the sample songs
  }
  const songs = Array.isArray(parsed?.songs) ? parsed.songs.filter(isValidImported) : [];
  if (Array.isArray(parsed?.songs) && songs.length < parsed.songs.length) {
    console.warn(`[songs] Ignored ${parsed.songs.length - songs.length} damaged entries in ${path.basename(file)}`);
  }
  return songs;
}

function localCatalogue() {
  const seen = new Set();
  return [...SAMPLE_SONGS, ...loadImportedSongs()]
    .filter((song) => !seen.has(song.id) && seen.add(song.id))
    .map(withPlayback);
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
  });
}

let LOCAL = localCatalogue();
let cache = { songs: LOCAL, source: 'local', loadedAt: 0, problem: null, note: null };

async function selectSongs(columns) {
  return getPublicClient().from('songs').select(columns).limit(5000);
}

async function load() {
  if (!isSupabaseConfigured) return cache;
  if (cache.loadedAt && Date.now() - cache.loadedAt < CACHE_MS) return cache;

  let problem = null;
  try {
    let note = null;
    let { data, error } = await selectSongs(MUSIC_COLUMNS);
    if (error?.code === '42703') {
      // The Phase 7 migration has not been run yet: read the older columns.
      note = 'Run supabase/migrations/002_music_sources.sql to enable cover art and licences for imported songs';
      ({ data, error } = await selectSongs(BASE_COLUMNS));
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

  if (cache.problem !== problem) console.warn(`[songs] ${problem}. Using built-in sample songs.`);
  cache = { songs: LOCAL, source: 'local', loadedAt: Date.now(), problem, note: null };
  return cache;
}

export const songRepository = {
  async findAll() {
    return (await load()).songs;
  },

  async findById(id) {
    return (await load()).songs.find((song) => song.id === id) ?? null;
  },

  async findByIds(ids) {
    const byId = new Map((await load()).songs.map((song) => [song.id, song]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  },

  // Used by the health check.
  async status({ fresh = false } = {}) {
    if (fresh) cache.loadedAt = 0;
    const { songs, source, problem, note } = await load();
    return {
      configured: isSupabaseConfigured,
      source,
      songs: songs.length,
      by_provider: songs.reduce((counts, song) => ({ ...counts, [song.provider ?? 'sample']: (counts[song.provider ?? 'sample'] ?? 0) + 1 }), {}),
      problem: problem ?? note,
    };
  },

  // Re-reads the imported songs file (used by tests).
  reloadLocal() {
    LOCAL = localCatalogue();
    cache = { songs: LOCAL, source: 'local', loadedAt: 0, problem: null, note: null };
  },
};
