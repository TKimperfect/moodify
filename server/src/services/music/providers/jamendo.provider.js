// Jamendo: independent artists who publish under Creative Commons licences.
// Full songs may be streamed for free in NON-COMMERCIAL projects (MOODIFY).
// Each song's licence and artist must be credited, so every Jamendo song
// carries its licence link and a link to its Jamendo page.
//
// Two uses:
//  1. Import: scripts/import-jamendo.js turns Jamendo songs into catalogue
//     songs (with moods, energy...) so the recommendation engine can use them.
//  2. Live search on the Discover page.
import { env } from '../../../config/env.js';
import { HttpError } from '../../../lib/httpError.js';
import { MOOD_HINTS } from '../../../data/taxonomy.js';
import { fetchJson, createCache } from './http.js';

const cache = createCache();
export const isJamendoConfigured = () => Boolean(env.jamendo.clientId);

// ---- Turning Jamendo's tags into MOODIFY's vocabulary ---------------------

const GENRE_MAP = {
  pop: 'pop', indie: 'indie', alternative: 'alternative',
  rock: 'rock', metal: 'rock', punk: 'rock', hardrock: 'rock', grunge: 'rock', poprock: 'rock',
  electronic: 'electronic', electro: 'electronic', techno: 'electronic', house: 'electronic', dance: 'electronic',
  edm: 'electronic', dubstep: 'electronic', trance: 'electronic', synthwave: 'electronic', synthpop: 'electronic', idm: 'electronic',
  ambient: 'ambient', chillout: 'ambient', newage: 'ambient', soundtrack: 'ambient', downtempo: 'ambient', cinematic: 'ambient',
  lounge: 'lo-fi', lofi: 'lo-fi', triphop: 'lo-fi', chillhop: 'lo-fi',
  hiphop: 'hip-hop', rap: 'hip-hop', trap: 'hip-hop',
  rnb: 'r&b', soul: 'r&b', funk: 'r&b',
  jazz: 'jazz', blues: 'jazz',
  classical: 'classical', piano: 'classical', orchestral: 'classical',
  folk: 'folk', acoustic: 'folk', country: 'folk', singersongwriter: 'folk',
};

const MOOD_MAP = {
  sad: 'sad', melancholic: 'sad', melancholy: 'sad', sorrow: 'sad', emotional: 'sad', dark: 'sad',
  happy: 'happy', joyful: 'happy', cheerful: 'happy', fun: 'happy', positive: 'happy', uplifting: 'happy', upbeat: 'happy', bright: 'happy',
  calm: 'calm', relaxing: 'calm', relaxed: 'calm', peaceful: 'calm', soft: 'calm', chill: 'calm', gentle: 'calm', quiet: 'calm', serene: 'calm',
  energetic: 'motivated', powerful: 'motivated', motivational: 'motivated', inspiring: 'motivated', motivating: 'motivated', epic: 'motivated', driving: 'motivated', sport: 'motivated',
  romantic: 'romantic', love: 'romantic', sensual: 'romantic',
  angry: 'angry', aggressive: 'angry', rage: 'angry', heavy: 'angry',
  nostalgic: 'nostalgic', retro: 'nostalgic', vintage: 'nostalgic', memories: 'nostalgic',
  tense: 'anxious', suspense: 'anxious', anxious: 'anxious', nervous: 'anxious', dramatic: 'anxious', mysterious: 'anxious',
  lonely: 'lonely', alone: 'lonely', introspective: 'lonely',
  dreamy: 'empty', ethereal: 'empty', atmospheric: 'empty', meditative: 'empty', hypnotic: 'empty', spacey: 'empty', minimal: 'empty',
};

const SPEED = {
  verylow: { energy: 15, bpm: 66 },
  low: { energy: 30, bpm: 82 },
  medium: { energy: 50, bpm: 104 },
  high: { energy: 72, bpm: 126 },
  veryhigh: { energy: 88, bpm: 148 },
};

const STRONG_TAGS = new Set(['epic', 'powerful', 'dark', 'aggressive', 'emotional', 'dramatic', 'heavy']);
const SOFT_TAGS = new Set(['soft', 'gentle', 'minimal', 'quiet', 'calm', 'peaceful']);

const clean = (value) => String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
const clamp = (value) => Math.min(100, Math.max(0, Math.round(value)));
const tempoOf = (bpm) => (bpm < 90 ? 'slow' : bpm <= 120 ? 'medium' : 'fast');

// "http://creativecommons.org/licenses/by-nc-sa/3.0/" -> "CC BY-NC-SA 3.0"
export function licenceName(url) {
  const match = /licenses\/([a-z-]+)\/([\d.]+)/i.exec(url ?? '');
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : 'Creative Commons';
}

function tagsOf(track) {
  const tags = track.musicinfo?.tags ?? {};
  return {
    genres: (tags.genres ?? []).map(clean),
    vartags: (tags.vartags ?? []).map(clean),
  };
}

// Turns one Jamendo track into a MOODIFY catalogue song.
// "hintMood" is the mood that was searched for when importing.
export function mapJamendoTrack(track, { hintMood = null, rank = 0 } = {}) {
  const { genres: rawGenres, vartags } = tagsOf(track);

  const genres = [...new Set(rawGenres.map((tag) => GENRE_MAP[tag]).filter(Boolean))].slice(0, 2);
  if (genres.length === 0) genres.push(track.musicinfo?.vocalinstrumental === 'instrumental' ? 'ambient' : 'indie');

  const moodsFound = vartags.map((tag) => MOOD_MAP[tag]).filter(Boolean);
  const moods = [...new Set([hintMood, ...moodsFound].filter(Boolean))].slice(0, 2);
  if (moods.length === 0) moods.push('calm');

  const speed = SPEED[clean(track.musicinfo?.speed)];
  const hint = MOOD_HINTS[moods[0]];
  let energy = speed?.energy ?? hint.energy;
  if (!speed && moods[1]) energy = (energy + MOOD_HINTS[moods[1]].energy) / 2;
  const bpm = speed?.bpm ?? Math.round(70 + energy * 0.8);

  let intensity = moods.reduce((sum, mood) => sum + MOOD_HINTS[mood].intensity, 0) / moods.length;
  if (vartags.some((tag) => STRONG_TAGS.has(tag))) intensity += 15;
  if (vartags.some((tag) => SOFT_TAGS.has(tag))) intensity -= 15;

  const effects = [...moods.flatMap((mood) => MOOD_HINTS[mood].effects)];
  if (energy >= 70) effects.unshift('energize');
  if (moods.includes('angry')) effects.unshift('release');
  if (energy <= 30) effects.push('atmosphere');

  const licenceUrl = track.license_ccurl || null;
  const song = {
    id: `jamendo-${String(track.id).replace(/[^0-9]/g, '')}`,
    title: String(track.name ?? 'Untitled').trim().slice(0, 200) || 'Untitled',
    artist: String(track.artist_name ?? 'Unknown artist').trim().slice(0, 200) || 'Unknown artist',
    genres,
    moods,
    effects: [...new Set(effects)].slice(0, 3),
    energy: clamp(energy),
    intensity: clamp(intensity),
    bpm,
    tempo: tempoOf(bpm),
    popularity: clamp(85 - rank * 2),
    year: Number.parseInt(String(track.releasedate ?? '').slice(0, 4), 10) || new Date().getFullYear(),
    provider: 'jamendo',
    external_url: track.shareurl || null,
    preview_url: track.audio || null, // the full-song stream
    artwork_url: track.album_image || track.image || null,
    album: track.album_name || null,
    duration_s: Number(track.duration) || null,
    license_url: licenceUrl,
  };
  return song;
}

// ---- Calling the API --------------------------------------------------------

async function callTracks(params) {
  if (!isJamendoConfigured()) throw new HttpError(503, 'Jamendo is not configured on this server (JAMENDO_CLIENT_ID)');
  const query = new URLSearchParams({
    client_id: env.jamendo.clientId,
    format: 'json',
    include: 'musicinfo licenses',
    audioformat: 'mp32',
    imagesize: '300',
    ...params,
  });
  const data = await fetchJson(`${env.jamendo.apiBase}/v3.0/tracks/?${query}`, 'Jamendo');
  if (data.headers?.status && data.headers.status !== 'success') {
    const message = String(data.headers.error_message ?? '');
    if (/client/i.test(message)) throw new HttpError(502, 'Jamendo rejected the client_id. Check JAMENDO_CLIENT_ID');
    throw new HttpError(502, 'Jamendo could not complete the request');
  }
  return (data.results ?? []).filter((track) => track && track.id && track.audio);
}

// Tracks for one mood, used by the import script.
export async function fetchTracksForMood(tags, { limit = 30 } = {}) {
  return callTracks({ fuzzytags: tags.join(' '), order: 'popularity_total', groupby: 'artist_id', limit: String(limit) });
}

// Live search on the Discover page.
export async function searchJamendo(query, limit = 10) {
  const key = `${query.toLowerCase()}|${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const tracks = await callTracks({ search: query, limit: String(Math.min(limit, 10)) });
  const songs = tracks.map((track, rank) => ({ ...mapJamendoTrack(track, { rank }), external: true }));
  cache.set(key, songs);
  return songs;
}

export function clearJamendoCache() {
  cache.clear();
}
