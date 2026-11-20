import { searchSongs, getSong, getDiscover } from '../services/catalog.service.js';

export async function listSongs(req, res) {
  const { songs, total } = await searchSongs(req.valid.query);
  // count: songs in this reply; total: all songs that match.
  res.json({ songs, count: songs.length, total, offset: req.valid.query.offset ?? 0 });
}

export async function showSong(req, res) {
  const song = await getSong(req.valid.params.id);
  if (!song) return res.status(404).json({ error: { message: 'Song not found' } });
  res.json({ song });
}

export async function showDiscover(req, res) {
  res.json(await getDiscover());
}
