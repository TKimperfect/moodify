// Personal playlists.
import { unwrap, HttpError } from '../lib/httpError.js';
import { toSong } from '../repositories/song.repository.js';

const COLUMNS = 'id,name,description,mood_session_id,created_at,updated_at';
const MAX_PLAYLISTS = 100;
const MAX_SONGS = 500;
const NOT_FOUND = { PGRST116: [404, 'Playlist not found'] };

async function requirePlaylist(db, id) {
  const playlist = unwrap(await db.from('playlists').select('id').eq('id', id).maybeSingle());
  if (!playlist) throw new HttpError(404, 'Playlist not found');
}

export async function listPlaylists(db) {
  const rows = unwrap(
    await db.from('playlists').select(`${COLUMNS}, playlist_songs(count)`).order('created_at', { ascending: false }).limit(MAX_PLAYLISTS),
  );
  return rows.map(({ playlist_songs: counts, ...playlist }) => ({ ...playlist, song_count: counts?.[0]?.count ?? 0 }));
}

export async function getPlaylist(db, id) {
  const row = unwrap(
    await db.from('playlists').select(`${COLUMNS}, playlist_songs(position, added_at, songs(*))`).eq('id', id).maybeSingle(),
  );
  if (!row) throw new HttpError(404, 'Playlist not found');
  const { playlist_songs: entries, ...playlist } = row;
  const songs = entries
    .filter((entry) => entry.songs)
    .sort((a, b) => a.position - b.position)
    .map((entry) => ({ song: toSong(entry.songs), position: entry.position, added_at: entry.added_at }));
  return { ...playlist, song_count: songs.length, songs };
}

export async function createPlaylist(db, userId, { name, description, mood_session_id, song_ids }) {
  const { count } = await db.from('playlists').select('id', { count: 'exact', head: true });
  if ((count ?? 0) >= MAX_PLAYLISTS) throw new HttpError(409, `You can have at most ${MAX_PLAYLISTS} playlists`);

  const playlist = unwrap(
    await db.from('playlists').insert({ user_id: userId, name, description, mood_session_id: mood_session_id ?? null }).select(COLUMNS).single(),
    { 23503: [404, 'Mood session not found'] },
  );

  if (song_ids.length > 0) {
    const rows = song_ids.map((song_id, position) => ({ playlist_id: playlist.id, song_id, position }));
    const { error } = await db.from('playlist_songs').insert(rows);
    if (error) {
      // Do not leave a half-made playlist behind.
      await db.from('playlists').delete().eq('id', playlist.id);
      unwrap({ error }, { 23503: [404, 'One of the songs does not exist'] });
    }
  }
  return getPlaylist(db, playlist.id);
}

export async function updatePlaylist(db, id, changes) {
  const playlist = unwrap(await db.from('playlists').update(changes).eq('id', id).select(COLUMNS).maybeSingle(), NOT_FOUND);
  if (!playlist) throw new HttpError(404, 'Playlist not found');
  return playlist;
}

export async function deletePlaylist(db, id) {
  const removed = unwrap(await db.from('playlists').delete().eq('id', id).select('id'));
  if (removed.length === 0) throw new HttpError(404, 'Playlist not found');
}

export async function addSongToPlaylist(db, id, songId) {
  await requirePlaylist(db, id);
  const existing = unwrap(
    await db.from('playlist_songs').select('position').eq('playlist_id', id).order('position', { ascending: false }).limit(MAX_SONGS),
  );
  if (existing.length >= MAX_SONGS) throw new HttpError(409, `A playlist can hold at most ${MAX_SONGS} songs`);
  const position = existing.length > 0 ? existing[0].position + 1 : 0;

  unwrap(await db.from('playlist_songs').insert({ playlist_id: id, song_id: songId, position }), {
    23505: [409, 'That song is already in this playlist'],
    23503: [404, 'Song not found'],
  });
  return getPlaylist(db, id);
}

export async function removeSongFromPlaylist(db, id, songId) {
  await requirePlaylist(db, id);
  const removed = unwrap(await db.from('playlist_songs').delete().eq('playlist_id', id).eq('song_id', songId).select('song_id'));
  if (removed.length === 0) throw new HttpError(404, 'That song is not in this playlist');
  return getPlaylist(db, id);
}
