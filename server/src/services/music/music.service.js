// The music service: one place that decides, for any song, what can be
// played and where it can be heard. Pages never talk to providers directly,
// so adding a provider later only changes this folder.
import { mkdir, writeFile, rename, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sampleProvider } from './providers/sample.provider.js';
import { youtubeProvider, isYouTubeConfigured } from './providers/youtube.provider.js';
import { isSpotifyConfigured, searchSpotify } from './providers/spotify.provider.js';
import { isDeezerEnabled, searchDeezer } from './providers/deezer.provider.js';
import { isJamendoConfigured, searchJamendo, licenceName } from './providers/jamendo.provider.js';
import { renderSongWav } from './synth.js';
import { HttpError } from '../../lib/httpError.js';

const AUDIO_VERSION = 'v1'; // change to regenerate every cached clip
const CACHE_DIR = path.join(os.tmpdir(), 'moodify-audio', AUDIO_VERSION);

const PROVIDER_NAMES = { jamendo: 'Jamendo', spotify: 'Spotify', deezer: 'Deezer', youtube: 'YouTube' };

// Fresh Deezer preview links, kept for 20 minutes.
const deezerPreviews = new Map();
export async function deezerPreviewUrl(trackId) {
  const cached = deezerPreviews.get(trackId);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { fetchJson } = await import('./providers/http.js');
  const { env } = await import('../../config/env.js');
  const data = await fetchJson(`${env.deezer.apiBase}/track/${trackId}`, 'Deezer');
  if (data.error || !data.preview) throw new HttpError(404, 'Deezer has no preview for this song');
  if (deezerPreviews.size > 2000) deezerPreviews.clear();
  deezerPreviews.set(trackId, { url: data.preview, expires: Date.now() + 20 * 60 * 1000 });
  return data.preview;
}
const nameOf = (provider) => PROVIDER_NAMES[provider] ?? `${provider[0].toUpperCase()}${provider.slice(1)}`;

function linksFor(song) {
  const links = [];
  if (song.external_url) links.push({ provider: song.provider, label: `${nameOf(song.provider)} page`, url: song.external_url });
  if (song.license_url) links.push({ provider: 'licence', label: licenceName(song.license_url), url: song.license_url });
  if (song.provider !== 'jamendo') links.push(youtubeProvider.searchLink(song));
  return links;
}

// Playback information for a catalogue song.
export function playbackFor(song) {
  const fullOnYouTube = isYouTubeConfigured() && song.language !== 'instrumental' && song.provider !== 'sample' && song.provider !== 'jamendo';
  return { ...basePlayback(song), youtube: fullOnYouTube };
}

function basePlayback(song) {
  if (song.provider === 'deezer' && !song.preview_url) {
    // Deezer preview links expire, so the server fetches a fresh one when played.
    return {
      status: 'preview',
      source: 'deezer',
      audio_url: `/api/audio/deezer/${song.id.replace(/^deezer-/, '')}`,
      duration_s: 30,
      label: 'Deezer preview · 30s',
      links: linksFor(song),
    };
  }
  if (song.provider === 'jamendo' && song.preview_url) {
    // Creative Commons music: the full song may be streamed (non-commercial use).
    return {
      status: 'preview',
      source: 'jamendo',
      audio_url: song.preview_url,
      duration_s: song.duration_s ?? null,
      label: `Full song · ${licenceName(song.license_url)} via Jamendo`,
      full: true,
      links: linksFor(song),
    };
  }
  if (song.preview_url) {
    return { status: 'preview', source: song.provider ?? 'database', audio_url: song.preview_url, duration_s: 30, label: 'Preview · 30s', links: linksFor(song) };
  }
  if (!song.provider || song.provider === 'sample') return sampleProvider.playback(song);
  return {
    status: song.external_url ? 'external' : 'unavailable',
    source: song.provider,
    audio_url: null,
    duration_s: null,
    label: song.external_url ? `No preview available · listen on ${nameOf(song.provider)}` : 'No playable audio for this song',
    links: linksFor(song),
  };
}

export function withPlayback(song) {
  return { ...song, playback: playbackFor(song) };
}

export function providersStatus() {
  return {
    sample: { enabled: true, label: 'Sample audio', note: 'Original generated audio for the development catalogue' },
    jamendo: { enabled: isJamendoConfigured(), label: 'Jamendo', search: true, note: 'Full Creative Commons songs (non-commercial use)' },
    deezer: { enabled: isDeezerEnabled(), label: 'Deezer', search: true, note: 'Well-known songs, 30-second previews' },
    spotify: { enabled: isSpotifyConfigured(), label: 'Spotify', search: true, note: 'Song information and links; previews only where Spotify provides them' },
    youtube: { enabled: true, label: 'YouTube', full_songs: isYouTubeConfigured(), note: isYouTubeConfigured() ? 'Full songs in an embedded YouTube player' : 'Search links' },
  };
}

const SEARCHERS = {
  jamendo: async (q, limit) => (await searchJamendo(q, limit)).map((song) => ({ ...withPlayback(song), external: true })),
  deezer: searchDeezer,
  spotify: searchSpotify,
};

export async function searchExternal({ q, source, limit }) {
  const status = providersStatus()[source];
  if (!status?.enabled) throw new HttpError(503, `${nameOf(source)} search is not available on this server`);
  return SEARCHERS[source](q, limit);
}

// Returns the path of the generated WAV file for a sample song,
// creating (and caching) it the first time.
export async function sampleAudioFile(song) {
  const file = path.join(CACHE_DIR, `${song.id}.wav`);
  try {
    await stat(file);
    return file;
  } catch {
    // Not generated yet.
  }
  await mkdir(CACHE_DIR, { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, renderSongWav(song));
  await rename(temporary, file); // atomic: never serve a half-written file
  return file;
}
