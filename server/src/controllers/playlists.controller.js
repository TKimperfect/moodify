import * as playlists from '../services/playlists.service.js';

export async function getPlaylists(req, res) {
  const items = await playlists.listPlaylists(req.db);
  res.json({ playlists: items, count: items.length });
}

export async function postPlaylist(req, res) {
  res.status(201).json({ playlist: await playlists.createPlaylist(req.db, req.user.id, req.valid.body) });
}

export async function getPlaylist(req, res) {
  res.json({ playlist: await playlists.getPlaylist(req.db, req.valid.params.id) });
}

export async function patchPlaylist(req, res) {
  res.json({ playlist: await playlists.updatePlaylist(req.db, req.valid.params.id, req.valid.body) });
}

export async function deletePlaylist(req, res) {
  await playlists.deletePlaylist(req.db, req.valid.params.id);
  res.status(204).end();
}

export async function postPlaylistSong(req, res) {
  res.status(201).json({ playlist: await playlists.addSongToPlaylist(req.db, req.valid.params.id, req.valid.body.song_id) });
}

export async function deletePlaylistSong(req, res) {
  const { id, songId } = req.valid.params;
  res.json({ playlist: await playlists.removeSongFromPlaylist(req.db, id, songId) });
}
