// Connects the engine to the song storage and to what is known about the user.
import { songRepository } from '../repositories/song.repository.js';
import { recommend } from './recommendation/engine.js';
import { listFavoriteIds } from './favorites.service.js';
import { listRejectedIds, listSkippedIds } from './history.service.js';
import { unwrap } from '../lib/httpError.js';

const merge = (a, b) => [...new Set([...a, ...b])];

export async function getRecommendations({ profile, feedback, limit }, db = null) {
  let { liked, rejected, skipped } = feedback;
  let usedFavoriteGenres = false;

  // Logged-in users: add what the database remembers about their taste.
  if (db) {
    try {
      const [favoriteIds, rejectedIds, skippedIds, account] = await Promise.all([
        listFavoriteIds(db),
        listRejectedIds(db),
        listSkippedIds(db),
        db.from('profiles').select('favorite_genres').maybeSingle().then(unwrap),
      ]);
      liked = merge(liked, favoriteIds);
      rejected = merge(rejected, rejectedIds);
      skipped = merge(skipped, skippedIds);
      // No genres chosen for this mood? Use the favourite genres from the profile.
      if (profile.genres.length === 0 && account?.favorite_genres?.length) {
        profile = { ...profile, genres: account.favorite_genres };
        usedFavoriteGenres = true;
      }
    } catch (error) {
      console.warn('Could not load saved feedback, continuing without it:', error.message);
    }
  }

  const songs = await songRepository.findAll();
  const result = recommend({ profile, songs, feedback: { liked, rejected, recent: feedback.recent, skipped }, limit });
  return { ...result, used_favorite_genres: usedFavoriteGenres };
}
