// Spotify Web API: real song information and links (optional).
//
// What Spotify does and does not give us (late 2026):
//  - Full songs can NOT be played through the Web API. Only the Spotify app
//    or the Web Playback SDK (Premium users) can play full tracks.
//  - 30-second previews ("preview_url") are missing for most tracks, and for
//    apps created after November 2024 they are not provided at all.
//  - Since February 2026, apps in Development Mode only work while the app
//    owner has Spotify Premium, and search returns at most 10 results.
// So every Spotify result carries a clear playback status and a link that
// opens the song in Spotify.
import { env } from '../../../config/env.js';
import { HttpError } from '../../../lib/httpError.js';
import { youtubeProvider } from './youtube.provider.js';

const MAX_RESULTS = 10;
let token = { value: null, expiresAt: 0 };

export const isSpotifyConfigured = () => Boolean(env.spotify.clientId && env.spotify.clientSecret);

async function call(url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(503, 'Spotify could not be reached');
  }
}

function explain(status) {
  if (status === 401 || status === 400) return new HttpError(502, 'Spotify rejected the app credentials (check SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)');
  if (status === 403) return new HttpError(502, 'Spotify refused access. Development Mode apps need the app owner to have Spotify Premium');
  if (status === 429) return new HttpError(503, 'Spotify is rate limiting requests. Try again in a minute');
  return new HttpError(502, `Spotify returned an error (${status})`);
}

async function getToken() {
  if (token.value && Date.now() < token.expiresAt - 60_000) return token.value;
  const basic = Buffer.from(`${env.spotify.clientId}:${env.spotify.clientSecret}`).toString('base64');
  const response = await call(`${env.spotify.accountsBase}/api/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw explain(response.status);
  const data = await response.json();
  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

export function resetSpotifyToken() {
  token = { value: null, expiresAt: 0 };
}

// Picks a medium-sized cover image (about 300px) when there is one.
function pickImage(images = []) {
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((image) => (image.width ?? 0) >= 250) ?? sorted.at(-1))?.url ?? null;
}

export function mapTrack(track) {
  const song = {
    id: `spotify-${String(track.id).toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 80),
    external: true,
    provider: 'spotify',
    title: track.name,
    artist: (track.artists ?? []).map((artist) => artist.name).join(', ') || 'Unknown artist',
    album: track.album?.name ?? null,
    year: Number.parseInt(track.album?.release_date?.slice(0, 4), 10) || null,
    artwork_url: pickImage(track.album?.images),
    genres: [],
    moods: [],
  };
  const spotifyLink = track.external_urls?.spotify
    ? { provider: 'spotify', label: 'Open in Spotify', url: track.external_urls.spotify }
    : null;
  const links = [spotifyLink, youtubeProvider.searchLink(song)].filter(Boolean);
  song.playback = track.preview_url
    ? { status: 'preview', source: 'spotify', audio_url: track.preview_url, duration_s: 30, label: 'Spotify preview · 30s', links }
    : { status: 'external', source: 'spotify', audio_url: null, duration_s: Math.round((track.duration_ms ?? 0) / 1000) || null, label: 'No preview from Spotify · listen on Spotify', links };
  return song;
}

export async function searchSpotify(query, limit = MAX_RESULTS) {
  if (!isSpotifyConfigured()) throw new HttpError(503, 'Spotify is not configured on this server');
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(Math.min(limit, MAX_RESULTS)) });
  if (env.spotify.market) params.set('market', env.spotify.market);

  let response = await call(`${env.spotify.apiBase}/v1/search?${params}`, { headers: { Authorization: `Bearer ${await getToken()}` } });
  if (response.status === 401) {
    // Token expired early: get a new one once.
    resetSpotifyToken();
    response = await call(`${env.spotify.apiBase}/v1/search?${params}`, { headers: { Authorization: `Bearer ${await getToken()}` } });
  }
  if (!response.ok) throw explain(response.status);
  const data = await response.json();
  return (data.tracks?.items ?? []).filter((track) => track && track.id).map(mapTrack);
}
