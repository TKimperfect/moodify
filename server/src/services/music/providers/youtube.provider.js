// YouTube: full songs through YouTube's own embedded player (optional).
//
// Without YOUTUBE_API_KEY, songs only get a "Search on YouTube" link.
// With it, MOODIFY finds a matching video once per song and plays it in a
// visible YouTube player (YouTube requires the player to be shown, at least
// 200x200 pixels). YouTube's rules also say data from its API must be checked
// again or deleted after 30 days, so every stored video id has a check date.
import { env } from '../../../config/env.js';
import { HttpError } from '../../../lib/httpError.js';

export const RECHECK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
export const isYouTubeConfigured = () => Boolean(env.youtube.apiKey);

export const youtubeProvider = {
  id: 'youtube',
  searchLink(song) {
    const query = encodeURIComponent(`${song.title} ${song.artist}`);
    return { provider: 'youtube', label: 'Search on YouTube', url: `https://www.youtube.com/results?search_query=${query}` };
  },
};

async function call(path, params) {
  const query = new URLSearchParams({ ...params, key: env.youtube.apiKey });
  let response;
  try {
    response = await fetch(`${env.youtube.apiBase}/youtube/v3/${path}?${query}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(503, 'YouTube could not be reached');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason ?? '';
    if (/quota/i.test(reason)) throw new HttpError(503, "YouTube's free daily limit for MOODIFY has been reached. Full songs will be back tomorrow");
    if (response.status === 400 || response.status === 403) throw new HttpError(502, 'YouTube rejected the API key (check YOUTUBE_API_KEY)');
    throw new HttpError(502, `YouTube returned an error (${response.status})`);
  }
  return data;
}

const playable = (video) => video?.status?.embeddable === true && video.status.privacyStatus === 'public' && video.status.uploadStatus === 'processed';

// Is this video still there and allowed in other sites? (costs 1 quota unit)
export async function isStillPlayable(videoId) {
  const data = await call('videos', { part: 'status', id: videoId });
  return playable(data.items?.[0]);
}

const clean = (text) => String(text).toLowerCase().replace(/\s+/g, ' ');
const AVOID = /\b(cover|karaoke|instrumental|remix|8d|slowed|sped up|nightcore|reaction|tutorial|piano version)\b|翻唱|伴奏/i;

// Picks the most likely official video for a song (search costs 100 units).
export async function findVideo(song) {
  const search = await call('search', {
    part: 'snippet',
    type: 'video',
    maxResults: '6',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    q: `${song.title} ${song.artist}`,
  });
  const ids = (search.items ?? []).map((item) => item.id?.videoId).filter(Boolean);
  if (ids.length === 0) return null;
  const details = await call('videos', { part: 'status,snippet', id: ids.join(',') });
  const title = clean(song.title);
  const artist = clean(song.artist.split(',')[0]);
  const scored = (details.items ?? [])
    .filter(playable)
    .map((video, index) => {
      const text = clean(`${video.snippet?.title ?? ''} ${video.snippet?.channelTitle ?? ''}`);
      let score = -index; // YouTube's own ranking still matters
      if (text.includes(title)) score += 4;
      if (text.includes(artist)) score += 3;
      if (/official|官方|topic|mv\b/i.test(text)) score += 2;
      if (AVOID.test(text) && !AVOID.test(`${song.title}`)) score -= 6;
      return { id: video.id, title: video.snippet?.title ?? '', channel: video.snippet?.channelTitle ?? '', score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score > -3 ? scored[0] : null;
}
