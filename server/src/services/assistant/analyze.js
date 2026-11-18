// Reads one message and lists every mood, wish, energy cue, tempo and genre
// it mentions, together with the words that gave it away (the "evidence").
import {
  MOOD_PATTERNS,
  EFFECT_PATTERNS,
  ENERGY_LOW,
  ENERGY_HIGH,
  MORE_ENERGY,
  LESS_ENERGY,
  INTENSIFIERS,
  DIMINISHERS,
  OVERWHELM,
  TEMPO_PATTERNS,
  GENRE_PATTERNS,
  UNSURE,
  CRISIS,
} from './lexicon.js';

const NEGATION_BEFORE = /\b(?:not|never|no|don'?t|do not|didn'?t|isn'?t|wasn'?t|aren'?t|ain'?t|without|hardly|barely)\s+(?:\w+\s+){0,2}$/;

export function normalize(text) {
  return ` ${String(text).toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()} `;
}

// All non-negated matches of one pattern in the text.
function findAll(text, { re, negatable }) {
  const hits = [];
  re.lastIndex = 0;
  for (const match of text.matchAll(re)) {
    const before = text.slice(Math.max(0, match.index - 30), match.index);
    if (negatable && NEGATION_BEFORE.test(before)) continue;
    hits.push(match[0].trim());
  }
  return hits;
}

function scan(text, table) {
  const found = [];
  for (const [id, patterns] of Object.entries(table)) {
    const list = Array.isArray(patterns) ? patterns : [patterns];
    const words = list.flatMap((pattern) => findAll(text, pattern));
    if (words.length > 0) found.push({ id, words: [...new Set(words)], count: words.length });
  }
  return found;
}

export function analyzeText(raw) {
  const text = normalize(raw);

  const moods = scan(text, MOOD_PATTERNS).sort((a, b) => b.count - a.count);
  const effects = scan(text, EFFECT_PATTERNS); // keeps table order for ties
  const bestEffect = effects.reduce((best, item) => (!best || item.count > best.count ? item : best), null);

  let energy = null;
  const low = findAll(text, ENERGY_LOW);
  const high = findAll(text, ENERGY_HIGH);
  if (low.length > high.length) energy = { value: 15, words: low };
  else if (high.length > low.length) energy = { value: 85, words: high };

  let energyShift = 0;
  if (findAll(text, MORE_ENERGY).length) energyShift += 20;
  if (findAll(text, LESS_ENERGY).length) energyShift -= 20;

  let intensityShift = 0;
  intensityShift += Math.min(25, findAll(text, INTENSIFIERS).length * 10);
  intensityShift += findAll(text, OVERWHELM).length ? 20 : 0;
  intensityShift += /!{2,}/.test(text) ? 10 : 0;
  intensityShift -= findAll(text, DIMINISHERS).length ? 20 : 0;

  const tempo = scan(text, TEMPO_PATTERNS)[0]?.id ?? null;
  const genres = scan(text, GENRE_PATTERNS).map((item) => item.id);

  return {
    moods,
    effect: bestEffect,
    energy,
    energyShift,
    intensityShift,
    tempo,
    genres,
    unsure: findAll(text, UNSURE).length > 0,
    crisis: findAll(text, CRISIS).length > 0,
  };
}
