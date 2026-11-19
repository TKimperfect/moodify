// Works out which language a song is sung in, from what we know about it:
//   1. its title or artist written in a script (Korean, Japanese, Chinese...)
//   2. the same artist's other songs that are written in a script
//   3. Malay words, or French / Spanish / other words and accents, in the title
//   4. artists known from Western music (MuSe, English playlists) -> English
//   5. otherwise the language of the playlists the song was found in
//      (e.g. a K-pop song with an English title found in Korean playlists)
// Songs in a language MOODIFY does not offer get "other".
export const HANGUL = /[가-힯ᄀ-ᇿ㄰-㆏]/;
export const KANA = /[぀-ヿ]/;
export const HAN = /[一-鿿㐀-䶿]/;
const OTHER_SCRIPT = /[฀-๿Ѐ-ӿ؀-ۿऀ-ॿ֐-׿Ͱ-Ͽ]/; // Thai, Cyrillic, Arabic, Hindi, Hebrew, Greek
const ACCENTS = /[àâçèéêëîïôûùüÿñœæßäöåãõìòí]/i;
const CHINESE = ['zh', 'yue', 'nan'];

const words = (text) => String(text ?? '').toLowerCase().normalize('NFC').split(/[^\p{L}']+/u).filter(Boolean);
const setOf = (text) => new Set(text.split(/\s+/));

const MALAY_WORDS = setOf(
  `aku kau engkau dikau cinta cintaku hati hatiku yang dan tak tidak untuk rindu rinduku sayang sayangku kita kami itu dari
   jangan selamanya kasih kekasih bila akan sudah pergi hidup malam bintang mimpi cahaya jiwa setia terima
   lagu kenangan seribu bersama sendiri hanya pernah takkan biar biarlah kerana karena luka pulang kembali hujan senja dalam tanpa
   abang adik kekal syurga doa selamat semangat tenang gembira sedih jiwang balada aksara bahagia gadis rasa`,
);
const ENGLISH_WORDS = setOf(
  `the you i i'm me my your you're love it it's in of to and is be we all don't can't baby girl boy night heart time life never feel
   like want need one up down go got get on what when this that with for no oh yeah way back home world tonight forever dance
   let know just think good bad say take make little light dream fire`,
);
const OTHER_WORDS = setOf(
  `le les je il elle nous vous des du et est mon mes pas pour avec sur dans une c'est j'ai qui
   el los las mi que por para con amor corazón yo te una del mujer quiero
   eu você não meu minha com sono della non der die das und ich nicht mein ein eine ist`,
);

export const artistKey = (name) => String(name ?? '').trim().toLowerCase();

// Language from the writing system alone; null for the Latin alphabet.
export function scriptLanguage(text, chineseHint = 'zh') {
  if (HANGUL.test(text)) return 'ko';
  if (KANA.test(text)) return 'ja';
  if (HAN.test(text)) return chineseHint;
  if (OTHER_SCRIPT.test(text)) return 'other';
  return null;
}

// Which Chinese language to use for Chinese characters, from where the song was found.
function chineseHintFor(foundIn = []) {
  return foundIn.find((language) => CHINESE.includes(language)) ?? (foundIn.includes('ja') ? 'ja' : 'zh');
}

// Each artist's language, from their songs that are written in a script.
export function artistLanguages(songs) {
  const votes = new Map();
  for (const song of songs) {
    const language = scriptLanguage(`${song.title} ${song.artist}`, chineseHintFor(song.foundIn));
    if (!language || language === 'other') continue;
    const key = artistKey(song.artist);
    const tally = votes.get(key) ?? {};
    tally[language] = (tally[language] ?? 0) + 1;
    votes.set(key, tally);
  }
  const result = new Map();
  for (const [key, tally] of votes) result.set(key, Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]);
  return result;
}

// Artists known from Western music: MuSe, and artists found mostly in English playlists.
export function westernArtists(songs, extraArtists = []) {
  const result = new Set([...extraArtists].map(artistKey));
  const tally = new Map();
  for (const song of songs) {
    const key = artistKey(song.artist);
    const entry = tally.get(key) ?? { en: 0, other: 0 };
    if ((song.foundIn ?? []).includes('en')) entry.en += 1;
    else entry.other += 1;
    tally.set(key, entry);
  }
  for (const [key, { en, other }] of tally) if (en > other) result.add(key);
  return result;
}

export function detectLanguage(song, { byArtist = new Map(), western = new Set(), fallback = 'en' } = {}) {
  const foundIn = song.foundIn ?? [];
  const fromScript = scriptLanguage(`${song.title} ${song.artist}`, chineseHintFor(foundIn));
  if (fromScript) return fromScript;
  const key = artistKey(song.artist);
  if (byArtist.has(key)) return byArtist.get(key);
  const titleWords = words(song.title);
  if (titleWords.some((word) => MALAY_WORDS.has(word))) return 'ms';
  const english = titleWords.some((word) => ENGLISH_WORDS.has(word));
  if (!english && (ACCENTS.test(song.title) || titleWords.some((word) => OTHER_WORDS.has(word)))) return 'other';
  if (western.has(key)) return 'en';
  return foundIn.find((language) => language !== 'en') ?? fallback;
}

// Gives every song its language. "foundIn" (or "found_in", as saved in the
// local files) lists the languages of the playlists a song was found in.
export function labelLanguages(songs, { extraWesternArtists = [], fallback = 'en' } = {}) {
  const prepared = songs.map(({ foundIn, found_in: saved, ...song }) => ({ ...song, foundIn: foundIn ?? saved ?? [] }));
  const byArtist = artistLanguages(prepared);
  const western = westernArtists(prepared, extraWesternArtists);
  const changes = [];
  const labelled = prepared.map(({ foundIn, ...song }) => {
    const language = detectLanguage({ ...song, foundIn }, { byArtist, western, fallback });
    if (song.language && song.language !== language) changes.push({ id: song.id, from: song.language, to: language, example: `${song.artist} – ${song.title}` });
    return foundIn.length ? { ...song, language, found_in: foundIn } : { ...song, language };
  });
  return { songs: labelled, changes };
}

// "Mandarin → English: 120 (e.g. Pitbull – Give Me Everything)" lines.
export function describeChanges(changes, names = {}) {
  const groups = new Map();
  for (const change of changes) {
    const key = `${change.from}>${change.to}`;
    const group = groups.get(key) ?? { ...change, count: 0, examples: [] };
    group.count += 1;
    if (group.examples.length < 2) group.examples.push(change.example);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .map((group) => `${names[group.from] ?? group.from} → ${names[group.to] ?? group.to}: ${group.count} (e.g. ${group.examples.join(' · ')})`);
}
