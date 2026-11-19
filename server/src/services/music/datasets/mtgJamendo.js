// MTG-Jamendo dataset: Jamendo songs with human mood/theme tags.
// Bogdanov et al. (2019), "The MTG-Jamendo Dataset for Automatic Music Tagging".
// Metadata licence: CC BY-NC-SA 4.0, for non-commercial research and academic
// use (MOODIFY is a non-commercial student project). Credited on /credits.
import { deriveFromMoods } from '../../../data/taxonomy.js';

export const MTG_TSV_URL = 'https://raw.githubusercontent.com/MTG/mtg-jamendo-dataset/master/data/autotagging_moodtheme.tsv';

// The 59 MTG mood/theme tags, translated to MOODIFY moods.
// Tags about use (film, advertising, game...) say nothing about mood and are ignored.
const TAG_MOODS = {
  happy: ['happy', 'fun', 'funny', 'positive', 'upbeat', 'party', 'summer', 'holiday', 'christmas', 'children', 'groovy', 'cool'],
  sad: ['sad', 'melancholic', 'emotional', 'drama'],
  angry: ['heavy'],
  anxious: ['horror', 'dramatic', 'trailer', 'dark'],
  calm: ['calm', 'relaxing', 'soft', 'mellow', 'meditative', 'nature', 'slow', 'background'],
  nostalgic: ['retro', 'travel'],
  motivated: ['energetic', 'motivational', 'inspiring', 'uplifting', 'sport', 'epic', 'powerful', 'hopeful', 'fast', 'action', 'adventure'],
  empty: ['soundscape', 'space', 'deep', 'dream', 'ambiental'],
  romantic: ['love', 'romantic', 'sexy', 'ballad'],
};
const HIGH_ENERGY = new Set(['energetic', 'fast', 'action', 'party', 'sport', 'upbeat', 'powerful', 'epic', 'heavy', 'groovy']);
const LOW_ENERGY = new Set(['calm', 'relaxing', 'slow', 'soft', 'meditative', 'mellow', 'ambiental', 'nature', 'dream', 'space', 'deep']);
const STRONG = new Set(['epic', 'powerful', 'dramatic', 'heavy', 'emotional', 'dark', 'horror']);
const SOFT = new Set(['soft', 'calm', 'mellow', 'relaxing']);
const TAG_EFFECTS = {
  uplift: ['inspiring', 'hopeful', 'uplifting', 'positive'],
  energize: ['energetic', 'sport', 'party', 'fast', 'motivational'],
  release: ['heavy', 'powerful'],
  atmosphere: ['background', 'soundscape', 'ambiental', 'space'],
  comfort: ['relaxing', 'calm', 'meditative', 'soft'],
  embrace: ['love', 'romantic', 'sexy', 'emotional', 'sad', 'melancholic'],
  memories: ['retro'],
};

// "track_0000948\t...\tmood/theme---background\tmood/theme---film" -> { id: 948, tags: [...] }
export function parseMtgTsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const cells = line.split('\t');
    if (cells.length < 6) continue;
    const id = Number.parseInt(cells[0].replace(/\D/g, ''), 10);
    const tags = cells.slice(5).map((cell) => cell.replace(/^mood\/theme---/, '').trim()).filter(Boolean);
    if (id && tags.length) rows.push({ id, duration: Number(cells[4]) || null, tags });
  }
  return rows;
}

// Turns MTG tags into MOODIFY moods, energy and effects (null if no mood at all).
export function moodsFromTags(tags) {
  const score = Object.fromEntries(Object.entries(TAG_MOODS).map(([mood, list]) => [mood, tags.filter((tag) => list.includes(tag)).length]));
  // Sad and slow/soft/deep together read as lonely (ranked above plain "calm").
  if (score.sad > 0 && tags.some((tag) => ['slow', 'soft', 'mellow', 'ballad', 'deep'].includes(tag))) score.lonely = score.sad + 0.5;
  // Dark with energy reads as angry.
  if (tags.includes('dark') && tags.some((tag) => ['energetic', 'fast', 'powerful', 'heavy'].includes(tag))) score.angry = (score.angry ?? 0) + 1;
  const moods = Object.entries(score)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([mood]) => mood);
  if (moods.length === 0) return null;

  const high = tags.filter((tag) => HIGH_ENERGY.has(tag)).length;
  const low = tags.filter((tag) => LOW_ENERGY.has(tag)).length;
  const energy = high > low ? 78 : low > high ? 25 : undefined;
  const derived = deriveFromMoods(moods, {
    energy,
    strong: tags.some((tag) => STRONG.has(tag)),
    soft: tags.some((tag) => SOFT.has(tag)),
  });
  const tagEffects = Object.entries(TAG_EFFECTS)
    .filter(([, list]) => tags.some((tag) => list.includes(tag)))
    .map(([effect]) => effect);
  return { moods, ...derived, effects: [...new Set([...tagEffects, ...derived.effects])].slice(0, 3) };
}

// Picks up to "perMood" tagged tracks for each MOODIFY mood, most-tagged first.
export function pickTracks(rows, perMood) {
  const chosen = new Map();
  const byMood = new Map();
  for (const row of rows) {
    const mood = moodsFromTags(row.tags);
    if (!mood) continue;
    const list = byMood.get(mood.moods[0]) ?? [];
    list.push({ ...row, mood });
    byMood.set(mood.moods[0], list);
  }
  for (const list of byMood.values()) {
    list
      .sort((a, b) => b.tags.length - a.tags.length || b.id - a.id)
      .slice(0, perMood)
      .forEach((row) => chosen.set(row.id, row));
  }
  return [...chosen.values()];
}
