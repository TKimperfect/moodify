// Pure logic for the mood profile (no React here, so it is easy to test).
// It turns what the user picked on screen into the structured profile
// that the recommendation engine will read in Phase 4.
import { MOODS, MAX_MOODS } from '../data/moods.js';
import {
  DESIRED_EFFECTS,
  TEMPOS,
  GENRES,
  MOOD_HINTS,
  ENERGY_WORDS,
  INTENSITY_WORDS,
} from '../data/spectrum.js';
import { LANGUAGES } from '../data/languages.js';

const MOOD_IDS = MOODS.map((mood) => mood.id);
const EFFECT_IDS = DESIRED_EFFECTS.map((effect) => effect.id);
const TEMPO_IDS = TEMPOS.map((tempo) => tempo.id);
const GENRE_IDS = GENRES.map((genre) => genre.id);
const LANGUAGE_IDS = LANGUAGES.map((language) => language.id);

// What the screen looks like before the user touches anything.
export const DEFAULT_DRAFT = Object.freeze({
  moods: [],
  energy: 50,
  intensity: 50,
  tempo: 'any',
  desiredEffect: null,
  genres: [],
  languages: [], // empty = any language (or the favourites saved in the profile)
  spectrumTouched: false, // true once the user moves a slider themselves
});

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(100, Math.max(0, Math.round(number)));
}

// Suggested slider positions for the selected moods (average, rounded to 5).
export function suggestSpectrum(moods) {
  const hints = moods.map((id) => MOOD_HINTS[id]).filter(Boolean);
  if (hints.length === 0) return { energy: 50, intensity: 50 };
  const average = (key) => {
    const mean = hints.reduce((sum, hint) => sum + hint[key], 0) / hints.length;
    return Math.round(mean / 5) * 5;
  };
  return { energy: average('energy'), intensity: average('intensity') };
}

// Experiences that people often choose with the selected moods.
export function suggestedEffects(moods) {
  return [...new Set(moods.flatMap((id) => MOOD_HINTS[id]?.effects ?? []))];
}

// "72" -> "charged"
export function levelWord(value, words) {
  return words[Math.min(words.length - 1, Math.floor(clamp(value) / 20))];
}

// What is still needed before the profile can be used.
export function missingSteps(draft) {
  const missing = [];
  if (draft.moods.length === 0) missing.push('Pick at least one mood');
  if (!draft.desiredEffect) missing.push('Choose what you want from the music');
  return missing;
}

// The structured mood profile. Returns null while steps are missing.
export function buildProfile(draft) {
  if (missingSteps(draft).length > 0) return null;
  return {
    moods: MOOD_IDS.filter((id) => draft.moods.includes(id)).slice(0, MAX_MOODS),
    energy: clamp(draft.energy),
    intensity: clamp(draft.intensity),
    genres: GENRE_IDS.filter((id) => draft.genres.includes(id)),
    desired_effect: draft.desiredEffect,
    tempo: draft.tempo,
    languages: LANGUAGE_IDS.filter((id) => (draft.languages ?? []).includes(id)),
  };
}

// Checks a profile that came from outside (for example browser storage)
// and returns a clean copy, or null if it cannot be trusted.
export function sanitizeProfile(input) {
  if (!input || typeof input !== 'object') return null;
  const moods = Array.isArray(input.moods) ? MOOD_IDS.filter((id) => input.moods.includes(id)) : [];
  if (moods.length === 0 || moods.length > MAX_MOODS) return null;
  if (!EFFECT_IDS.includes(input.desired_effect)) return null;
  return {
    moods,
    energy: clamp(input.energy),
    intensity: clamp(input.intensity),
    genres: Array.isArray(input.genres) ? GENRE_IDS.filter((id) => input.genres.includes(id)) : [],
    desired_effect: input.desired_effect,
    tempo: TEMPO_IDS.includes(input.tempo) ? input.tempo : 'any',
    languages: Array.isArray(input.languages) ? LANGUAGE_IDS.filter((id) => input.languages.includes(id)) : [],
  };
}

// Turns a saved profile back into screen state so it can be edited again.
export function draftFromProfile(profile) {
  return {
    moods: profile.moods,
    energy: profile.energy,
    intensity: profile.intensity,
    tempo: profile.tempo,
    desiredEffect: profile.desired_effect,
    genres: profile.genres,
    languages: profile.languages ?? [],
    spectrumTouched: true,
  };
}

function joinWords(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

// A plain-language sentence describing the profile.
export function summarizeProfile(profile) {
  const effect = DESIRED_EFFECTS.find((item) => item.id === profile.desired_effect);
  const genreLabels = GENRES.filter((genre) => profile.genres.includes(genre.id)).map((genre) => genre.label.toLowerCase());
  const parts = [
    `Feeling ${joinWords(profile.moods)}`,
    `${levelWord(profile.energy, ENERGY_WORDS)} energy`,
    `${levelWord(profile.intensity, INTENSITY_WORDS)} intensity`,
  ];
  let sentence = `${parts.join(', ')}. Wants music to "${effect.label.toLowerCase()}"`;
  sentence += profile.tempo === 'any' ? ', any tempo' : `, ${profile.tempo} tempo`;
  sentence += genreLabels.length > 0 ? `, leaning ${joinWords(genreLabels)}` : ', open to any genre';
  const languageLabels = LANGUAGES.filter((language) => (profile.languages ?? []).includes(language.id)).map((language) => language.label);
  sentence += languageLabels.length > 0 ? `, sung in ${joinWords(languageLabels)}.` : '.';
  return sentence;
}
