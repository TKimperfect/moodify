import { listFavorites, addFavorite, removeFavorite } from '../services/favorites.service.js';

export async function getFavorites(req, res) {
  const favorites = await listFavorites(req.db);
  res.json({ favorites, count: favorites.length });
}

export async function putFavorite(req, res) {
  await addFavorite(req.db, req.user.id, req.valid.params.songId);
  res.status(204).end();
}

export async function deleteFavorite(req, res) {
  await removeFavorite(req.db, req.user.id, req.valid.params.songId);
  res.status(204).end();
}
