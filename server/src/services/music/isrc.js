// Looks up the ISRC of Deezer songs (one request per song). An ISRC is the
// international code of a recording; its first letters tell the country of
// the label that released it, which helps to tell a song's language.
import { env } from '../../config/env.js';
import { fetchJson } from './providers/http.js';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let nextRequestAt = 0;
async function takeTurn() {
  const now = Date.now();
  const wait = Math.max(0, nextRequestAt - now);
  nextRequestAt = Math.max(now, nextRequestAt) + env.deezer.requestGapMs;
  if (wait) await pause(wait);
}

// The ISRC of one Deezer song: a string, null (Deezer has none), or
// undefined (could not be checked now; try again later).
export async function deezerIsrc(songId) {
  const trackId = String(songId).replace(/^deezer-/, '');
  if (!/^\d+$/.test(trackId)) return null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await takeTurn();
    let data;
    try {
      data = await fetchJson(`${env.deezer.apiBase}/track/${trackId}`, 'Deezer');
    } catch {
      await pause(1000 * (attempt + 1));
      continue;
    }
    if (data?.error?.code === 4) {
      await pause(5000); // too many requests: wait, then try again
      continue;
    }
    if (data?.error) return null; // e.g. the song was removed from Deezer
    return typeof data?.isrc === 'string' && data.isrc ? data.isrc : null;
  }
  return undefined;
}

// Looks up every id that `known` (a Map) does not have yet, a few at a time.
// onCheckpoint(known) is called every `every` songs so progress can be saved.
export async function fetchIsrcs(ids, { known = new Map(), shouldStop = () => false, onProgress = () => {}, onCheckpoint = async () => {}, every = 300 } = {}) {
  const todo = [...new Set(ids)].filter((id) => !known.has(id));
  let done = 0;
  let failed = 0;
  let next = 0;
  async function worker() {
    while (next < todo.length && !shouldStop()) {
      const id = todo[next];
      next += 1;
      const isrc = await deezerIsrc(id);
      if (isrc === undefined) failed += 1;
      else known.set(id, isrc);
      done += 1;
      if (done % every === 0) {
        onProgress({ done, total: todo.length, failed });
        await onCheckpoint(known);
      }
    }
  }
  await Promise.all(Array.from({ length: env.deezer.lookupWorkers }, worker));
  await onCheckpoint(known);
  return { known, checked: done, total: todo.length, failed, stopped: done < todo.length };
}
