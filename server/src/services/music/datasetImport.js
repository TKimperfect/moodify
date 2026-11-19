// Imports the two research datasets into MOODIFY's catalogue.
//   MTG-Jamendo: human mood tags + Jamendo's API for title, audio and licence.
//   MuSe:        listener-tag mood scores + Deezer to find a playable version.
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/httpError.js';
import { fetchJson } from './providers/http.js';
import { mapJamendoTrack, isJamendoConfigured } from './providers/jamendo.provider.js';
import { detectLanguage } from './language.js';
import { MTG_TSV_URL, parseMtgTsv, pickTracks } from './datasets/mtgJamendo.js';
import { MUSE_CSV_URLS, readMuse, pickMuse } from './datasets/muse.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Some download sites refuse requests that do not say who is asking.
const HEADERS = { 'User-Agent': 'MOODIFY/1.2 (non-commercial student project; dataset import)', Accept: 'text/csv,text/plain,*/*' };

// Tries each address in turn; the error explains how to download by hand.
async function download(urls, name) {
  let last = '';
  for (const url of [urls].flat()) {
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(120_000) });
      if (response.ok) return response.text();
      last = `${response.status}`;
    } catch {
      last = 'no connection';
    }
  }
  throw new HttpError(502, `Downloading the ${name} file failed (${last}). Download it in your browser and pass its path to the command (see the README)`);
}

// ---- MTG-Jamendo -----------------------------------------------------------

async function jamendoDetailsOnce(ids) {
  // Jamendo accepts several ids joined with "+" (sent as %2B).
  const query = new URLSearchParams({
    client_id: env.jamendo.clientId,
    format: 'json',
    id: ids.join('+'),
    limit: String(ids.length),
    include: 'musicinfo licenses',
    audioformat: 'mp32',
    imagesize: '300',
  });
  const data = await fetchJson(`${env.jamendo.apiBase}/v3.0/tracks/?${query}`, 'Jamendo');
  if (data.headers?.status && data.headers.status !== 'success') {
    const reason = String(data.headers.error_message ?? '').trim();
    if (/client/i.test(reason)) throw new HttpError(502, 'Jamendo rejected the client_id. Check JAMENDO_CLIENT_ID');
    throw new HttpError(502, `Jamendo could not complete the request${reason ? `: ${reason}` : ''}`);
  }
  return data.results ?? [];
}

// Asks for many songs at once; if Jamendo refuses a batch, splits it into
// smaller ones (down to one song at a time), so the import always finishes.
export async function jamendoDetails(ids, onRetry = () => {}) {
  try {
    return await jamendoDetailsOnce(ids);
  } catch (error) {
    if (/client_id/.test(error.message)) throw error;
    if (ids.length === 1) return []; // this one song cannot be fetched: skip it
    onRetry(error.message, ids.length);
    const half = Math.ceil(ids.length / 2);
    await pause(300);
    const first = await jamendoDetails(ids.slice(0, half), onRetry);
    const second = await jamendoDetails(ids.slice(half), onRetry);
    return [...first, ...second];
  }
}

export async function importMtgJamendo({ perMood = Infinity, tsvText, onProgress = () => {} } = {}) {
  if (!isJamendoConfigured()) throw new HttpError(503, 'JAMENDO_CLIENT_ID is needed to fetch the songs');
  const text = tsvText ?? (await download(env.datasets.mtgUrl || MTG_TSV_URL, 'MTG-Jamendo'));
  const rows = parseMtgTsv(text);
  onProgress({ step: 'read', count: rows.length });
  const picked = pickTracks(rows, perMood);
  onProgress({ step: 'picked', count: picked.length });

  const songs = [];
  let warned = false;
  const BATCH = 40;
  for (let i = 0; i < picked.length; i += BATCH) {
    const batch = picked.slice(i, i + BATCH);
    const found = await jamendoDetails(
      batch.map((row) => row.id),
      (reason, size) => {
        if (!warned) onProgress({ step: 'retry', reason, size });
        warned = true;
      },
    );
    const details = new Map(found.map((track) => [Number(track.id), track]));
    for (const row of batch) {
      const track = details.get(row.id);
      if (!track?.audio) continue; // removed from Jamendo since the dataset was made
      const base = mapJamendoTrack(track);
      songs.push({ ...base, ...row.mood, tempo: row.mood.tempo, mood_source: 'mtg-jamendo' });
    }
    onProgress({ step: 'details', done: Math.min(i + BATCH, picked.length), total: picked.length, kept: songs.length });
    await pause(200);
  }
  return songs;
}

// ---- MuSe ------------------------------------------------------------------



// Looks a MuSe song up on Deezer. Returns { track } when found, or
// { reason: 'error' | 'no-results' | 'mismatch', detail } so the import can
// say why songs are missing.
// One shared pace for all lookups running at the same time, so MOODIFY never
// sends Deezer more than one request per "requestGapMs" (default 150 ms).
let nextRequestAt = 0;
async function takeTurn() {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + env.deezer.requestGapMs;
  if (wait) await pause(wait);
}

async function deezerSearch(q) {
  await takeTurn();
  let data;
  try {
    data = await fetchJson(`${env.deezer.apiBase}/search?${new URLSearchParams({ q, limit: '10' })}`, 'Deezer');
  } catch (error) {
    return { error: error.message };
  }
  if (data.error) {
    if (data.error.code === 4) {
      await pause(5000); // too many requests: wait and try once more
      return deezerSearch(q);
    }
    return { error: `Deezer: ${data.error.message ?? data.error.type ?? 'error'}` };
  }
  return { tracks: data.data ?? [] };
}

const simplify = (text) => String(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\bthe\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, '');

export function sameSong(row, track) {
  const artist = simplify(row.artist);
  const title = simplify(row.track);
  const foundArtist = simplify(track.artist?.name ?? '');
  const foundTitle = simplify(track.title ?? '');
  if (!artist || !title || !foundArtist || !foundTitle) return false;
  const artistOk = foundArtist.includes(artist) || artist.includes(foundArtist);
  const titleOk = foundTitle.includes(title) || title.includes(foundTitle);
  return artistOk && titleOk;
}

export async function findOnDeezer(row) {
  const clean = (text) => String(text).replace(/"/g, '');
  const queries = [`artist:"${clean(row.artist)}" track:"${clean(row.track)}"`, `${clean(row.artist)} ${clean(row.track)}`];
  let lastTracks = [];
  for (const q of queries) {
    const result = await deezerSearch(q);
    if (result.error) return { reason: 'error', detail: result.error };
    const match = result.tracks.find((track) => sameSong(row, track));
    if (match) return { track: match };
    if (result.tracks.length) lastTracks = result.tracks;
  }
  if (lastTracks.length === 0) return { reason: 'no-results', detail: `${row.artist} – ${row.track}` };
  return { reason: 'mismatch', detail: `MuSe "${row.artist} – ${row.track}" vs Deezer "${lastTracks[0].artist?.name} – ${lastTracks[0].title}"` };
}

// Imports MuSe songs. Every song with a mood is looked up on Deezer (no limit
// unless "perMood" is given), best documented songs first. "progress" lets a
// long run be stopped and continued later: songs already checked are skipped.
// Songs whose lookup failed with an error are NOT marked as checked.
export async function importMuse({ perMood = Infinity, csvText, progress = new Map(), onProgress = () => {}, onCheckpoint = () => {}, shouldStop = () => false } = {}) {
  const text = csvText ?? (await download(env.datasets.museUrl || MUSE_CSV_URLS, 'MuSe'));
  const rows = readMuse(text);
  onProgress({ step: 'read', count: rows.length, sample: rows.slice(0, 3).map((row) => `${row.artist} – ${row.track}`) });
  const limit = Number.isFinite(perMood) ? perMood * 2 : Infinity; // not every song is on Deezer
  const candidates = pickMuse(rows, limit);
  const keyOf = (row) => `${row.artist}|${row.track}`.toLowerCase();
  // Songs found in earlier runs get today's mood rules too (no new lookups).
  for (const row of candidates) {
    const song = progress.get(keyOf(row));
    if (song) progress.set(keyOf(row), { ...song, ...row.mood });
  }
  const perMoodKept = new Map();
  for (const song of progress.values()) if (song) perMoodKept.set(song.moods[0], (perMoodKept.get(song.moods[0]) ?? 0) + 1);
  const already = candidates.filter((row) => progress.has(keyOf(row))).length;
  onProgress({ step: 'start', total: candidates.length, already });

  const stats = { found: 0, error: 0, 'no-results': 0, mismatch: 0, examples: {} };
  const report = () => ({ step: 'matching', checked, total: candidates.length, kept: [...progress.values()].filter(Boolean).length, stats });
  let checked = already;
  let errorsInARow = 0;
  let halted = false;
  let firstReported = false;
  const queue = candidates.filter((row) => !progress.has(keyOf(row)));
  let next = 0;

  async function lookUp(row) {
    const key = keyOf(row);
    const mood = row.mood.moods[0];
    if (progress.has(key) || (perMoodKept.get(mood) ?? 0) >= perMood) return;
    const { track, reason, detail } = await findOnDeezer(row);
    if (reason) {
      stats[reason] += 1;
      stats.examples[reason] ??= detail;
      if (reason === 'error') {
        errorsInARow += 1; // not marked as checked: tried again next run
        if (errorsInARow >= 20 && !halted) {
          halted = true;
          onProgress({ ...report(), step: 'stopped', reason: detail });
        }
        return;
      }
    }
    errorsInARow = 0;
    checked += 1;
    let song = null;
    if (track?.id) {
      // MuSe is mostly English-language music; "npm run music:relabel-languages"
      // refines this with what the other imports know about each artist.
      const language = detectLanguage({ title: String(track.title ?? ''), artist: String(track.artist?.name ?? row.artist) });
      stats.found += 1;
      perMoodKept.set(mood, (perMoodKept.get(mood) ?? 0) + 1);
      song = {
        id: `deezer-${String(track.id).replace(/\D/g, '')}`,
        title: String(track.title).slice(0, 200),
        artist: String(track.artist?.name ?? row.artist).slice(0, 200),
        genres: ['pop'],
        ...row.mood,
        popularity: Math.round(Math.min(100, (Math.log10(Number(track.rank ?? 0) + 1) / 6) * 100)),
        year: null,
        provider: 'deezer',
        external_url: track.link ?? null,
        preview_url: null,
        artwork_url: track.album?.cover_medium ?? null,
        album: track.album?.title ?? null,
        duration_s: Number(track.duration) || null,
        license_url: null,
        language,
        mood_source: 'muse',
      };
    }
    progress.set(key, song); // null = checked, not on Deezer
    if (!firstReported && stats.found + stats['no-results'] + stats.mismatch >= 20) {
      firstReported = true;
      onProgress({ ...report(), step: 'first' });
    }
    if (checked % 100 === 0) {
      onProgress(report());
      await onCheckpoint(progress);
    }
  }

  // A few lookups at a time; each worker takes the next song from the queue.
  const worker = async () => {
    while (!halted && !shouldStop() && next < queue.length) await lookUp(queue[next++]);
  };
  await Promise.all(Array.from({ length: env.deezer.lookupWorkers }, worker));
  onProgress(report());
  return [...progress.values()].filter(Boolean);
}
