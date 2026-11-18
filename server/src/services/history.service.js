// Listening history: what was played, skipped or rejected ("not for me").
import { unwrap } from '../lib/httpError.js';
import { toSong } from '../repositories/song.repository.js';

export async function addHistoryEvent(db, userId, { song_id, event, mood_session_id }) {
  return unwrap(
    await db
      .from('listening_history')
      .insert({ user_id: userId, song_id, event, mood_session_id: mood_session_id ?? null })
      .select('id,song_id,event,mood_session_id,created_at')
      .single(),
    { 23503: [404, 'Song or mood session not found'] },
  );
}

export async function listHistory(db, { event, limit }) {
  let query = db.from('listening_history').select('id,event,mood_session_id,created_at, songs(*)').order('created_at', { ascending: false }).limit(limit);
  if (event) query = query.eq('event', event);
  const rows = unwrap(await query);
  return rows
    .filter((row) => row.songs)
    .map(({ songs, ...entry }) => ({ ...entry, song: toSong(songs) }));
}

async function idsFor(db, event, limit) {
  const rows = unwrap(
    await db.from('listening_history').select('song_id').eq('event', event).order('created_at', { ascending: false }).limit(limit),
  );
  return [...new Set(rows.map((row) => row.song_id))];
}

export const listRejectedIds = (db) => idsFor(db, 'rejected', 2000);
export const listSkippedIds = (db) => idsFor(db, 'skipped', 200);

// "Undo not for me": forget rejections of one song, or of all songs.
export async function clearRejections(db, userId, songId) {
  let query = db.from('listening_history').delete().eq('user_id', userId).eq('event', 'rejected');
  if (songId) query = query.eq('song_id', songId);
  const removed = unwrap(await query.select('id'));
  return removed.length;
}
