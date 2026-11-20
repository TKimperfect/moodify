// Browsing and searching the catalogue (used by the Discover page).
import { songRepository } from '../repositories/song.repository.js';
import { EFFECTS, GENRES, MOOD_IDS, LANGUAGES } from '../data/taxonomy.js';

const FEATURED_IDS = [
  'static-lullaby',
  'dial-up-heart',
  'empty-lobby-music',
  'run-the-red',
  'postcards-from-2003',
  'sunroom',
];

const byPopularity = (a, b) => b.popularity - a.popularity;

// Returns one page of the matching songs and how many match in total
// (offset = how many were shown already, for "Show more").
export async function searchSongs({ q, mood, genre, language, ids, limit, offset = 0 }) {
  if (ids) {
    const songs = await songRepository.findByIds(ids);
    return { songs, total: songs.length };
  }
  const needle = q?.trim().toLowerCase();
  const all = await songRepository.findAll();
  const matches = all
    .filter((song) => !mood || song.moods.includes(mood))
    .filter((song) => !genre || song.genres.includes(genre))
    .filter((song) => !language || song.language === language)
    .filter((song) => !needle || `${song.title} ${song.artist}`.toLowerCase().includes(needle))
    .sort(byPopularity);
  return { songs: matches.slice(offset, offset + limit), total: matches.length };
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
    newest: [...all].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || byPopularity(a, b)).slice(0, 8),
    genres: Object.entries(GENRES).map(([id, label]) => ({ id, label, count: count('genres', id) })),
    moods: MOOD_IDS.map((id) => ({ id, count: count('moods', id) })),
    languages: [...Object.entries(LANGUAGES), ['instrumental', 'Instrumental'], ['other', 'Other languages']].map(([id, label]) => ({
      id,
      label,
      count: all.filter((song) => song.language === id).length,
    })),
    catalogue_size: all.length,
  };
}
