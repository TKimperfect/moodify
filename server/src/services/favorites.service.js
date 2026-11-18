// Favourite songs.
import { unwrap, HttpError } from '../lib/httpError.js';
import { toSong } from '../repositories/song.repository.js';

export async function listFavorites(db) {
  const rows = unwrap(await db.from('favorites').select('created_at, songs(*)').order('created_at', { ascending: false }).limit(500));
  return rows.filter((row) => row.songs).map((row) => ({ song: toSong(row.songs), created_at: row.created_at }));
}

export async function listFavoriteIds(db) {
  const rows = unwrap(await db.from('favorites').select('song_id').limit(1000));
  return rows.map((row) => row.song_id);
}

export async function addFavorite(db, userId, songId) {
  const { error } = await db.from('favorites').insert({ user_id: userId, song_id: songId });
  if (error?.code === '23505') return; // already a favourite: nothing to do
  unwrap({ error }, { 23503: [404, 'Song not found'] });
}

export async function removeFavorite(db, userId, songId) {
  const removed = unwrap(await db.from('favorites').delete().eq('user_id', userId).eq('song_id', songId).select('song_id'));
  if (removed.length === 0) throw new HttpError(404, 'That song is not in your favourites');
}
