// MuSe: The Musical Sentiment Dataset (Akiki & Burghardt, 2021).
// About 90,000 songs with valence, arousal and dominance scores computed from
// Last.fm listener tags, plus the mood words ("seeds") the song was found by.
// Licence: CC BY 4.0. Credited on /credits.
import { deriveFromMoods } from '../../../data/taxonomy.js';

// Zenodo offers the same file at two addresses; both are tried.
export const MUSE_CSV_URLS = [
  'https://zenodo.org/records/4281165/files/muse_dataset.csv?download=1',
  'https://zenodo.org/api/records/4281165/files/muse_dataset.csv/content',
];

// MuSe seed words (AllMusic moods) translated to MOODIFY moods.
const SEED_MOODS = {
  happy: ['happy', 'cheerful', 'joyous', 'euphoric', 'fun', 'playful', 'upbeat', 'bright', 'carefree', 'exuberant', 'gleeful', 'lively', 'sunny', 'celebratory', 'whimsical', 'silly', 'humorous'],
  sad: ['sad', 'melancholy', 'gloomy', 'mournful', 'sorrowful', 'bleak', 'tragic', 'somber', 'plaintive', 'depressing', 'heartbreaking', 'brooding', 'grim', 'weary', 'despondent'],
  lonely: ['lonely', 'alienated', 'isolated', 'desolate', 'yearning', 'longing', 'regretful', 'lost'],
  angry: ['angry', 'aggressive', 'hostile', 'fiery', 'rebellious', 'confrontational', 'menacing', 'brash', 'harsh', 'volatile', 'rowdy', 'raucous', 'outraged', 'visceral', 'nihilistic', 'malevolent', 'brutal', 'savage'],
  anxious: ['anxious', 'nervous', 'tense', 'paranoid', 'ominous', 'unsettling', 'uneasy', 'agitated', 'restless', 'eerie', 'spooky', 'suspenseful', 'fractured', 'jittery', 'frantic', 'cathartic'],
  calm: ['calm', 'peaceful', 'relaxed', 'soothing', 'tranquil', 'serene', 'gentle', 'mellow', 'laid-back', 'quiet', 'meditative', 'warm', 'comforting', 'pastoral', 'easygoing', 'cool'],
  nostalgic: ['nostalgic', 'wistful', 'reflective', 'sentimental', 'autumnal', 'bittersweet', 'reminiscent', 'elegant', 'poignant'],
  motivated: ['energetic', 'confident', 'triumphant', 'rousing', 'uplifting', 'inspiring', 'empowering', 'driving', 'determined', 'ambitious', 'powerful', 'stirring', 'exciting', 'boisterous', 'intense', 'rollicking'],
  empty: ['detached', 'cold', 'hypnotic', 'ethereal', 'atmospheric', 'spacey', 'dreamy', 'numb', 'apathetic', 'bored', 'trippy', 'druggy', 'hazy', 'distant'],
  romantic: ['romantic', 'sensual', 'sexy', 'passionate', 'tender', 'intimate', 'amorous', 'seductive', 'sweet', 'affectionate', 'lush', 'sultry'],
};
const SEED_LOOKUP = new Map(Object.entries(SEED_MOODS).flatMap(([mood, seeds]) => seeds.map((seed) => [seed, mood])));

// A small CSV reader that understands quoted fields ("a, b" and "" escapes).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Finds columns by name, so both the Zenodo and the Kaggle (v3) files work.
export function readMuse(text) {
  const [header, ...rows] = parseCsv(text);
  const find = (...names) => header.findIndex((cell) => names.includes(cell.trim().toLowerCase()));
  const col = {
    track: find('track', 'title', 'song'),
    artist: find('artist'),
    seeds: find('seeds', 'seed'),
    valence: find('valence_tags', 'valence'),
    arousal: find('arousal_tags', 'arousal'),
    dominance: find('dominance_tags', 'dominance'),
    tags: find('number_of_emotion_tags'),
  };
  if (col.track < 0 || col.artist < 0 || col.valence < 0 || col.arousal < 0) {
    throw new Error('This does not look like the MuSe dataset (missing track, artist, valence or arousal columns)');
  }
  return rows
    .map((cells) => ({
      track: cells[col.track]?.trim(),
      artist: cells[col.artist]?.trim(),
      seeds: col.seeds >= 0 ? [...String(cells[col.seeds] ?? '').matchAll(/[a-z][a-z-]+/gi)].map((match) => match[0].toLowerCase()) : [],
      valence: Number(cells[col.valence]),
      arousal: Number(cells[col.arousal]),
      dominance: col.dominance >= 0 ? Number(cells[col.dominance]) : NaN,
      tagCount: col.tags >= 0 ? Number(cells[col.tags]) || 0 : 0,
    }))
    .filter((row) => row.track && row.artist && Number.isFinite(row.valence) && Number.isFinite(row.arousal));
}

// The Zenodo file has no mood words ("seeds"), only three scores per song:
// valence (unpleasant..pleasant), arousal (calm..excited) and dominance
// (powerless..in control). Songs are sorted into low / middle / high thirds
// of valence and arousal, measured on the file itself, and dominance tells
// anger (in control) from fear (powerless), as in Russell's and Mehrabian's
// emotion models:
//
//                 low arousal        middle arousal          high arousal
//   pleasant      calm               romantic                happy
//   in between    calm               nostalgic               motivated
//   unpleasant    empty / sad        lonely / sad            anxious / angry
//                 (powerless / not)  (powerless / not)       (powerless / not)
export const DEFAULT_CUTS = { valence: [4.5, 6], arousal: [3.6, 4.8], dominance: 5.2 };

function quantile(sorted, q) {
  if (sorted.length === 0) return NaN;
  const at = (sorted.length - 1) * q;
  const low = Math.floor(at);
  return sorted[low] + (sorted[Math.min(low + 1, sorted.length - 1)] - sorted[low]) * (at - low);
}

// Thirds of valence and arousal, and the middle of dominance, for these rows.
export function scoreCuts(rows) {
  if (rows.length < 30) return DEFAULT_CUTS; // too few songs to measure
  const sorted = (key) => rows.map((row) => row[key]).filter(Number.isFinite).sort((a, b) => a - b);
  const valence = sorted('valence');
  const arousal = sorted('arousal');
  const low = quantile(valence, 1 / 3);
  // Dominance goes up with valence, so measure its middle among the unpleasant
  // songs only (where it is used). Otherwise nearly all of them would count as
  // "powerless" and there would be almost no angry or sad songs.
  const dominance = rows.filter((row) => row.valence < low && Number.isFinite(row.dominance)).map((row) => row.dominance).sort((a, b) => a - b);
  return {
    valence: [low, quantile(valence, 2 / 3)],
    arousal: [quantile(arousal, 1 / 3), quantile(arousal, 2 / 3)],
    dominance: dominance.length ? quantile(dominance, 0.5) : DEFAULT_CUTS.dominance,
  };
}

export function moodFromScores({ valence, arousal, dominance }, cuts = DEFAULT_CUTS) {
  const v = valence < cuts.valence[0] ? 0 : valence < cuts.valence[1] ? 1 : 2;
  const a = arousal < cuts.arousal[0] ? 0 : arousal < cuts.arousal[1] ? 1 : 2;
  const inControl = Number.isFinite(dominance) ? dominance >= cuts.dominance : true;
  if (v === 2) return ['calm', 'romantic', 'happy'][a];
  if (v === 1) return ['calm', 'nostalgic', 'motivated'][a];
  if (a === 2) return inControl ? 'angry' : 'anxious';
  if (a === 1) return inControl ? 'sad' : 'lonely';
  return inControl ? 'sad' : 'empty';
}

export function moodsFromMuse(row, givenCuts) {
  const cuts = givenCuts?.valence ? givenCuts : DEFAULT_CUTS; // also safe inside .map()
  const fromSeeds = [...new Set((row.seeds ?? []).map((seed) => SEED_LOOKUP.get(seed)).filter(Boolean))];
  const fromScores = moodFromScores(row, cuts);
  const moods = [...new Set([...fromSeeds, fromScores].filter(Boolean))].slice(0, 2);
  if (moods.length === 0) return null;
  const energy = Math.round(Math.min(100, Math.max(0, (row.arousal / 7.5) * 100)));
  const derived = deriveFromMoods(moods, { energy });
  // Stronger feelings: far from neutral valence, or high dominance.
  const intensity = Math.round(Math.min(100, (Math.abs(row.valence - 5) / 4) * 60 + (Number.isFinite(row.dominance) ? (row.dominance / 7.5) * 40 : 20)));
  return { moods, ...derived, intensity };
}

// Picks up to "perMood" songs per primary mood, best documented first.
export function pickMuse(rows, perMood) {
  const cuts = scoreCuts(rows);
  const byMood = new Map();
  for (const row of rows) {
    const mood = moodsFromMuse(row, cuts);
    if (!mood) continue;
    const list = byMood.get(mood.moods[0]) ?? [];
    list.push({ ...row, mood });
    byMood.set(mood.moods[0], list);
  }
  const lists = [...byMood.values()].map((list) =>
    list.sort((a, b) => b.tagCount - a.tagCount || b.seeds.length - a.seeds.length).slice(0, perMood),
  );
  // Take turns between moods (one from each, then the next round), so a
  // stopped run already has songs for every mood instead of only the first.
  const picked = [];
  for (let i = 0; lists.some((list) => i < list.length); i += 1) {
    for (const list of lists) if (i < list.length) picked.push(list[i]);
  }
  return picked;
}
