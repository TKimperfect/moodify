// The vocabulary of MOODIFY: moods, desired effects, genres and tempos,
// plus how closely related they are to each other.
// The ids here must stay identical to the ones used by the frontend
// (client/src/data/moods.js and client/src/data/spectrum.js).

export const MOOD_IDS = [
  'happy', 'sad', 'lonely', 'angry', 'anxious',
  'calm', 'nostalgic', 'motivated', 'empty', 'romantic',
];

// "because" finishes the sentence "This one ...", so each is a verb phrase.
export const EFFECTS = {
  comfort: { label: 'Comfort me', because: 'is gentle enough to comfort without pushing you anywhere' },
  embrace: { label: 'Stay in it', because: 'stays inside the feeling instead of trying to fix it' },
  companionship: { label: 'Keep me company', because: 'feels like someone else is in the room' },
  release: { label: 'Let it out', because: 'is loud enough to let the pressure out' },
  atmosphere: { label: 'Fill the space', because: 'fills the space without asking anything of you' },
  memories: { label: 'Take me back', because: 'sounds like somewhere you have been before' },
  uplift: { label: 'Lift me up', because: 'brightens slowly, without forcing it' },
  energize: { label: 'Get me moving', because: 'is built to get you moving' },
};
export const EFFECT_IDS = Object.keys(EFFECTS);

export const GENRES = {
  indie: 'Indie',
  alternative: 'Alternative',
  pop: 'Pop',
  rock: 'Rock',
  electronic: 'Electronic',
  ambient: 'Ambient',
  'lo-fi': 'Lo-fi',
  'hip-hop': 'Hip-hop',
  'r&b': 'R&B',
  jazz: 'Jazz',
  classical: 'Classical',
  folk: 'Folk',
};
export const GENRE_IDS = Object.keys(GENRES);

export const TEMPO_IDS = ['slow', 'medium', 'fast', 'any'];

// Songs under 90 beats per minute are "slow", over 120 are "fast".
export function tempoOf(bpm) {
  if (bpm < 90) return 'slow';
  if (bpm <= 120) return 'medium';
  return 'fast';
}

// ---- Relatedness tables -------------------------------------------------
// 1 = identical, 0 = unrelated. Pairs not listed are unrelated.
function buildAffinity(pairs) {
  const table = new Map();
  for (const [a, b, value] of pairs) {
    table.set(`${a}|${b}`, value);
    table.set(`${b}|${a}`, value);
  }
  return (a, b) => (a === b ? 1 : (table.get(`${a}|${b}`) ?? 0));
}

export const moodAffinity = buildAffinity([
  ['sad', 'lonely', 0.5], ['sad', 'empty', 0.4], ['sad', 'nostalgic', 0.4],
  ['lonely', 'empty', 0.5], ['lonely', 'nostalgic', 0.3],
  ['angry', 'anxious', 0.3], ['angry', 'motivated', 0.3],
  ['anxious', 'sad', 0.3], ['anxious', 'lonely', 0.2],
  ['happy', 'motivated', 0.5], ['happy', 'romantic', 0.4], ['happy', 'calm', 0.3],
  ['calm', 'romantic', 0.3], ['calm', 'nostalgic', 0.3], ['calm', 'empty', 0.3],
  ['nostalgic', 'romantic', 0.4],
]);

export const effectAffinity = buildAffinity([
  ['comfort', 'companionship', 0.6], ['comfort', 'uplift', 0.4], ['comfort', 'atmosphere', 0.4],
  ['embrace', 'atmosphere', 0.4], ['embrace', 'memories', 0.4], ['embrace', 'release', 0.3],
  ['companionship', 'memories', 0.3],
  ['release', 'energize', 0.6],
  ['uplift', 'energize', 0.5],
]);

export const genreAffinity = buildAffinity([
  ['indie', 'alternative', 0.6], ['indie', 'folk', 0.5], ['indie', 'pop', 0.4],
  ['alternative', 'rock', 0.6],
  ['pop', 'r&b', 0.5], ['pop', 'electronic', 0.4],
  ['electronic', 'ambient', 0.5],
  ['ambient', 'lo-fi', 0.5], ['ambient', 'classical', 0.5],
  ['lo-fi', 'hip-hop', 0.5], ['lo-fi', 'jazz', 0.5],
  ['hip-hop', 'r&b', 0.6],
]);

// What the user wants changes the ENERGY of music that fits, even for the
// same mood. "Lift me up" aims a little above where they are; "Fill the
// space" a little below; "Let it out" needs power regardless.
export function targetEnergy(profile) {
  const { energy, desired_effect: effect } = profile;
  switch (effect) {
    case 'uplift': return Math.min(100, energy + 15);
    case 'energize': return Math.min(100, energy + 25);
    case 'release': return Math.max(energy, 70);
    case 'comfort': return Math.max(0, energy - 5);
    case 'atmosphere': return Math.max(0, energy - 10);
    default: return energy;
  }
}

// "A different direction": the contrasting experience offered as an alternative.
export const ALTERNATIVE_EFFECT = {
  comfort: 'embrace',
  embrace: 'comfort',
  companionship: 'atmosphere',
  release: 'comfort',
  atmosphere: 'companionship',
  memories: 'uplift',
  uplift: 'embrace',
  energize: 'release',
};

// How much each factor counts towards the final score (adds up to 1).
export const WEIGHTS = Object.freeze({
  mood: 0.3,
  effect: 0.25,
  genre: 0.2,
  tempo_energy: 0.15,
  history: 0.1,
});

export const ENERGY_WORDS = ['very low', 'low', 'steady', 'high', 'very high'];

// Starting points per mood (same values as client/src/data/spectrum.js).
// Used to estimate energy and intensity when the person has not said.
export const MOOD_HINTS = {
  happy: { energy: 70, intensity: 55, effects: ['embrace', 'uplift'] },
  sad: { energy: 25, intensity: 70, effects: ['comfort', 'embrace'] },
  lonely: { energy: 25, intensity: 65, effects: ['companionship', 'comfort'] },
  angry: { energy: 80, intensity: 85, effects: ['release', 'energize'] },
  anxious: { energy: 65, intensity: 75, effects: ['comfort', 'atmosphere'] },
  calm: { energy: 30, intensity: 30, effects: ['atmosphere', 'embrace'] },
  nostalgic: { energy: 40, intensity: 55, effects: ['memories', 'embrace'] },
  motivated: { energy: 85, intensity: 65, effects: ['energize', 'uplift'] },
  empty: { energy: 15, intensity: 40, effects: ['atmosphere', 'companionship'] },
  romantic: { energy: 45, intensity: 60, effects: ['embrace', 'memories'] },
};

export const MOOD_LABELS = {
  happy: 'Happy', sad: 'Sad', lonely: 'Lonely', angry: 'Angry', anxious: 'Anxious',
  calm: 'Calm', nostalgic: 'Nostalgic', motivated: 'Motivated', empty: 'Empty', romantic: 'Romantic',
};

// Languages a song can be sung in. "instrumental" has no vocals and fits any
// language choice; "other" is a language MOODIFY does not offer as a filter.
export const LANGUAGES = {
  en: 'English',
  ms: 'Malay',
  id: 'Indonesian',
  zh: 'Mandarin',
  yue: 'Cantonese',
  ko: 'Korean',
  ja: 'Japanese',
};
export const LANGUAGE_IDS = Object.keys(LANGUAGES);
export const SONG_LANGUAGE_IDS = [...LANGUAGE_IDS, 'instrumental', 'other'];
// Languages MOODIFY offered before (Taiwanese Hokkien until 1.2.13): still
// accepted in saved preferences, and quietly left out.
export const RETIRED_LANGUAGE_IDS = ['nan'];
export const withoutRetired = (languages) => (Array.isArray(languages) ? languages.filter((language) => !RETIRED_LANGUAGE_IDS.includes(language)) : languages);

// Shared rules for songs whose moods are known but whose energy, effects and
// tempo must be estimated (imported songs).
export function deriveFromMoods(moods, { energy: knownEnergy, strong = false, soft = false } = {}) {
  const hints = moods.map((mood) => MOOD_HINTS[mood]);
  const average = (key) => hints.reduce((sum, hint) => sum + hint[key], 0) / hints.length;
  const energy = Math.round(knownEnergy ?? average('energy'));
  let intensity = average('intensity');
  if (strong) intensity += 15;
  if (soft) intensity -= 15;
  const effects = moods.flatMap((mood) => MOOD_HINTS[mood].effects);
  if (energy >= 70) effects.unshift('energize');
  if (moods.includes('angry')) effects.unshift('release');
  if (energy <= 30) effects.push('atmosphere');
  // Rough tempo from energy: 25 -> 81 BPM (slow), 50 -> 103 (medium), 80 -> 128 (fast).
  const bpm = Math.round(60 + energy * 0.85);
  return {
    energy: Math.min(100, Math.max(0, energy)),
    intensity: Math.min(100, Math.max(0, Math.round(intensity))),
    effects: [...new Set(effects)].slice(0, 3),
    bpm,
    tempo: tempoOf(bpm),
  };
}
