// Scoring: how well does ONE song fit ONE mood profile?
// Each function returns a number from 0 (no fit) to 1 (perfect fit).
// Pure functions only: no database, no network. That makes them easy to test.
import {
  WEIGHTS,
  moodAffinity,
  effectAffinity,
  genreAffinity,
  targetEnergy,
} from '../../data/taxonomy.js';

const average = (numbers) => (numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0);
const best = (items, score) => Math.max(0, ...items.map(score));
const clamp01 = (value) => Math.min(1, Math.max(0, value));

// 30% - For every mood the user picked, how close does the song come?
export function moodScore(profile, song) {
  return average(profile.moods.map((mood) => best(song.moods, (songMood) => moodAffinity(mood, songMood))));
}

// 25% - Does the song do what the user wants music to do right now?
export function effectScore(profile, song) {
  return best(song.effects, (effect) => effectAffinity(profile.desired_effect, effect));
}

// 20% - Genre. With no genres requested every song gets the same neutral 0.5,
// so genre simply does not influence the order.
export function genreScore(profile, song) {
  if (profile.genres.length === 0) return 0.5;
  return best(song.genres, (songGenre) => best(profile.genres, (genre) => genreAffinity(genre, songGenre)));
}

// 15% - Tempo, energy and intensity.
const TEMPO_ORDER = { slow: 0, medium: 1, fast: 2 };
export function tempoEnergyScore(profile, song) {
  const energyFit = 1 - Math.abs(targetEnergy(profile) - song.energy) / 100;
  const intensityFit = 1 - Math.abs(profile.intensity - song.intensity) / 100;
  if (profile.tempo === 'any') return 0.6 * energyFit + 0.4 * intensityFit;
  const tempoFit = 1 - Math.abs(TEMPO_ORDER[profile.tempo] - TEMPO_ORDER[song.tempo]) / 2;
  return 0.4 * energyFit + 0.25 * intensityFit + 0.35 * tempoFit;
}

// "Taste": what we have learned from the user's likes and rejections.
// Liked songs add +1 to their genres, artist and moods; rejected songs -1;
// skipped songs -0.5.
// Skipped songs count half as much as an explicit "not for me".
export function buildTaste(likedSongs, rejectedSongs, skippedSongs = []) {
  const taste = { genres: new Map(), artists: new Map(), moods: new Map(), samples: 0 };
  const add = (map, key, amount) => map.set(key, (map.get(key) ?? 0) + amount);
  const learn = (songs, amount) => {
    for (const song of songs) {
      taste.samples += 1;
      song.genres.forEach((genre) => add(taste.genres, genre, amount));
      song.moods.forEach((mood) => add(taste.moods, mood, amount));
      add(taste.artists, song.artist, amount);
    }
  };
  learn(likedSongs, 1);
  learn(rejectedSongs, -1);
  learn(skippedSongs, -0.5);
  return taste;
}

// Scales a tally to the range -1..1 relative to the strongest opinion.
function opinion(map, key) {
  const strongest = Math.max(0, ...[...map.values()].map(Math.abs));
  return strongest === 0 ? 0 : (map.get(key) ?? 0) / strongest;
}

// 10% - Listening history. 0.5 means "no opinion yet".
export function historyScore(song, taste) {
  if (!taste || taste.samples === 0) return 0.5;
  const lean =
    0.5 * average(song.genres.map((genre) => opinion(taste.genres, genre))) +
    0.3 * opinion(taste.artists, song.artist) +
    0.2 * average(song.moods.map((mood) => opinion(taste.moods, mood)));
  return clamp01(0.5 + 0.5 * lean);
}

// All five parts, plus the weighted total.
export function scoreSong(profile, song, taste) {
  const parts = {
    mood: moodScore(profile, song),
    effect: effectScore(profile, song),
    genre: genreScore(profile, song),
    tempo_energy: tempoEnergyScore(profile, song),
    history: historyScore(song, taste),
  };
  const total = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + weight * parts[key], 0);
  return { parts, total };
}
