// Finds (and remembers) the YouTube video for a song.
// Stored in the songs table when the server has the Supabase secret key,
// otherwise in memory. Every stored id is re-checked after 30 days.
import { songRepository } from '../../repositories/song.repository.js';
import { createAdminClient, hasSecretKey } from '../../lib/supabase.js';
import { HttpError } from '../../lib/httpError.js';
import { findVideo, isStillPlayable, isYouTubeConfigured, RECHECK_AFTER_MS } from './providers/youtube.provider.js';

const memory = new Map(); // key -> { video_id, checked_at }

async function remember(key, songId, record) {
  memory.set(key, record);
  if (songId && hasSecretKey && songRepository.usesDatabase()) {
    const { error } = await createAdminClient()
      .from('songs')
      .update({ youtube_id: record.video_id, youtube_checked_at: record.checked_at })
      .eq('id', songId);
    if (error && error.code !== '42703' && error.code !== 'PGRST204') console.warn('[youtube] could not store video id:', error.message);
  }
}

async function forget(key, songId) {
  memory.delete(key);
  if (songId && hasSecretKey && songRepository.usesDatabase()) {
    await createAdminClient().from('songs').update({ youtube_id: null, youtube_checked_at: null }).eq('id', songId);
  }
}

export async function videoFor({ songId, title, artist }) {
  if (!isYouTubeConfigured()) throw new HttpError(503, 'Full songs on YouTube are not switched on for this server');

  let song = { title, artist };
  if (songId) {
    song = await songRepository.findById(songId);
    if (!song) throw new HttpError(404, 'Song not found');
    // Sample songs, Jamendo songs (already full) and instrumentals are not looked up.
    if (!song.playback?.youtube) throw new HttpError(404, 'This song is not available on YouTube in MOODIFY');
  }
  const key = songId ?? `${title}|${artist}`.toLowerCase();

  const stored = memory.get(key) ?? (song.youtube_id ? { video_id: song.youtube_id, checked_at: song.youtube_checked_at } : null);
  if (stored?.video_id) {
    const age = Date.now() - new Date(stored.checked_at ?? 0).getTime();
    if (age < RECHECK_AFTER_MS) return { video_id: stored.video_id, source: 'saved' };
    if (await isStillPlayable(stored.video_id)) {
      await remember(key, songId, { video_id: stored.video_id, checked_at: new Date().toISOString() });
      return { video_id: stored.video_id, source: 'rechecked' };
    }
    await forget(key, songId);
  }

  const video = await findVideo(song);
  if (!video) throw new HttpError(404, 'No playable YouTube video was found for this song');
  await remember(key, songId, { video_id: video.id, checked_at: new Date().toISOString() });
  return { video_id: video.id, source: 'search', title: video.title, channel: video.channel };
}

export function clearYouTubeMemory() {
  memory.clear();
}
