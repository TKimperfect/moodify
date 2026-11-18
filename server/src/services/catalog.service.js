// Browsing and searching the catalogue (used by the Discover page).
import { songRepository } from '../repositories/song.repository.js';
import { EFFECTS, GENRES, MOOD_IDS } from '../data/taxonomy.js';

const FEATURED_IDS = [
  'static-lullaby',
  'dial-up-heart',
  'empty-lobby-music',
  'run-the-red',
  'postcards-from-2003',
  'sunroom',
];

const byPopularity = (a, b) => b.popularity - a.popularity;

export async function searchSongs({ q, mood, genre, ids, limit }) {
  if (ids) return songRepository.findByIds(ids);
  const needle = q?.trim().toLowerCase();
  const all = await songRepository.findAll();
  return all
    .filter((song) => !mood || song.moods.includes(mood))
    .filter((song) => !genre || song.genres.includes(genre))
    .filter((song) => !needle || `${song.title} ${song.artist}`.toLowerCase().includes(needle))
    .sort(byPopularity)
    .slice(0, limit);
}

export async function getSong(id) {
  return songRepository.findById(id);
}

export async function getDiscover() {
  const all = await songRepository.findAll();
  const featured = await songRepository.findByIds(FEATURED_IDS);
  const count = (key, id) => all.filter((song) => song[key].includes(id)).length;

  return {
    featured: featured.map((song) => ({
      song,
      // One-line description based on what the song is best at.
      tagline: `This one ${EFFECTS[song.effects[0]].because}.`,
    })),
    trending: [...all].sort(byPopularity).slice(0, 8),
    hidden_gems: all.filter((song) => song.popularity < 40).sort(byPopularity).slice(0, 8),
    newest: [...all].sort((a, b) => b.year - a.year || byPopularity(a, b)).slice(0, 8),
    genres: Object.entries(GENRES).map(([id, label]) => ({ id, label, count: count('genres', id) })),
    moods: MOOD_IDS.map((id) => ({ id, count: count('moods', id) })),
    catalogue_size: all.length,
  };
}
