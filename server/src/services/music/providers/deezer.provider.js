// Deezer: real, well-known songs with 30-second previews.
// The public search needs no key. Deezer allows non-commercial use of the
// previews when Deezer is credited, so every result links back to Deezer.
// Preview links expire after a while, so they are never stored.
import { env } from '../../../config/env.js';
import { HttpError } from '../../../lib/httpError.js';
import { fetchJson, createCache } from './http.js';
import { youtubeProvider } from './youtube.provider.js';

const MAX_RESULTS = 10;
const cache = createCache();

export const isDeezerEnabled = () => env.deezer.enabled;

export function mapDeezerTrack(track) {
  const song = {
    id: `deezer-${String(track.id).replace(/[^0-9a-z]/gi, '').toLowerCase()}`.slice(0, 80),
    external: true,
    provider: 'deezer',
    title: track.title || track.title_short || 'Untitled',
    artist: track.artist?.name || 'Unknown artist',
    album: track.album?.title ?? null,
    year: null,
    artwork_url: track.album?.cover_medium || track.album?.cover || null,
    genres: [],
    moods: [],
  };
  const links = [
    track.link ? { provider: 'deezer', label: 'Listen on Deezer', url: track.link } : null,
    youtubeProvider.searchLink(song),
  ].filter(Boolean);
  song.playback = track.preview
    ? { status: 'preview', source: 'deezer', audio_url: track.preview, duration_s: 30, label: 'Deezer preview · 30s', links }
    : { status: 'external', source: 'deezer', audio_url: null, duration_s: track.duration || null, label: 'No preview from Deezer · listen on Deezer', links };
  return song;
}

export async function searchDeezer(query, limit = MAX_RESULTS) {
  if (!isDeezerEnabled()) throw new HttpError(503, 'Deezer search is switched off on this server');
  const count = Math.min(limit, MAX_RESULTS);
  const key = `${query.toLowerCase()}|${count}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({ q: query, limit: String(count) });
  const data = await fetchJson(`${env.deezer.apiBase}/search?${params}`, 'Deezer');
  // Deezer reports errors inside a normal reply: { error: { code, message } }.
  if (data.error) {
    if (data.error.code === 4) throw new HttpError(503, 'Deezer is busy right now. Try again in a few seconds');
    throw new HttpError(502, 'Deezer could not complete the search');
  }
  const songs = (data.data ?? []).filter((track) => track && track.id && (track.type ?? 'track') === 'track').map(mapDeezerTrack);
  cache.set(key, songs);
  return songs;
}

export function clearDeezerCache() {
  cache.clear();
}
