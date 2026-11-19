// Works out which language each song is sung in. Playlists mix languages
// (a "Chinese" playlist can hold French rap, a "Korean" one Japanese metal),
// so a playlist alone does not decide. What does, in this order:
//   1. instrumental music (karaoke, piano covers, spa music, lo-fi beats)
//   2. "(Japanese Ver.)", "(國)", "(粵語)" and similar marks in the title
//   3. the writing system of the title: Korean, Japanese, Chinese, Thai...
//   4. the song's ISRC: an international code every release has. Its first two
//      letters are the country of the label that registered it (JP, KR, HK,
//      TW, MY, ID...). Some labels are known (JYP's US label releases Korean
//      songs); distributors used all over the world tell nothing.
//   5. what is known about the artist from all their songs together
//   6. Malay, French, Spanish, German... words in the title
//   7. otherwise English
// Songs in a language MOODIFY does not offer get "other".
export const HANGUL = /[가-힯ᄀ-ᇿ㄰-㆏]/;
export const KANA = /[぀-ヿ]/;
export const HAN = /[一-鿿㐀-䶿]/;
const OTHER_SCRIPT = /[฀-๿Ѐ-ӿ؀-ۿऀ-ॿ֐-׿Ͱ-Ͽ]/; // Thai, Cyrillic, Arabic, Hindi, Hebrew, Greek
const ACCENTS = /[àáâçèéêëîïôóûùúüÿñœæßäöåãõìòí]/i;
const CHINESE = ['zh', 'yue'];
// Playlists of languages MOODIFY no longer offers (Taiwanese Hokkien) are not evidence.
const RETIRED = ['nan'];

const words = (text) =>
  String(text ?? '').toLowerCase().split(/[^\p{L}\p{N}_']+/u).filter((word) => word && !/^\d+$/.test(word));
const setOf = (text) => new Set(text.split(/\s+/).filter(Boolean));
// "Running Away (Acoustic Version / Non-Album Bonus Track)" -> "Running Away"
const mainTitle = (title) => String(title ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(/\s[-–]\s/)[0];
const count = (list, set) => list.filter((word) => set.has(word)).length;
export const artistKey = (name) => String(name ?? '').trim().toLowerCase();

// Word lists. The Malay list includes the words that are common in the titles
// of songs from Malaysian and Indonesian labels and rare elsewhere.
const MALAY_WORDS = setOf(`
  abadi abang adalah adik aduh aduhai aidilfitri airmata akan akhir akhirnya aksara aku alamak alasanmu andai
  angin angkasa antara anugerah apa api asmara asyik atau ayah ayam ayu bagai bagaikan bahagia bahasa baik
  balada balik bandar banget baru bayangan bebas begini begitu benar benci berakhir beraya bercanda bercinta
  berdiri berharap berhelah berhenti beri berlalu berpisah bersama bertemu berubah betapa biar biarlah bicara
  bidadari bila bintang biru bisa boleh bonda buat budi buka bukan bulan bumi bunga cahaya cantik cerita cinta
  cintai cintaku cintamu cukup cuma dah dahulu dalam dan danau dapat dari datang debu deh dekat demi dendang
  dengan derita dewi dialah dicintai difikirkan digelangi dihati dikau dirantai diri diriku dirimu disana
  disayang disayangi disini ditakdirkan doa dong duka dulu dunia engkau engkaulah esok fana gadis gadisku gak
  gema gembira gerhana gerimis gering getaran halaman hamba hampa hanya hanyut harapan harus hasrat hati hatiku
  hatimu hiasan hidup hijau hilang hingga hitam hujan ialah ibu idaman impian indah indonesia ingin ini insan
  intan irama istana itu izinkan jadi jaga jalan jangan janji jatuh jauh jemu jernih jika jiwa jiwang joget juga
  kalau kalut kamar kami kampung kamu karam karena karma kasih kata kau kecundang kehilangan kehilanganmu kekal
  kekasih kekasihku kemaafan kembali kembara kenangan kenapa kepadamu kepulangan kerana kerinduan kerna
  keroncong kertas kesayangan kesepian khabar kidungmu kini kisah kita kok kota kuasa kupohon lagu laila lalu
  lamunan langit larangan laut lautan lebaran lepas lepaskan luka lupa maaf madah mahligai mahu malam manis
  masih matahari mati mau mawar maya mekar melati memburu menang menangis menanti menara mencintai mencintaimu
  mengapa mengerti mengintai mengundang meniti menjelma mentari menunggu merah merdeka mereka merindu milik
  miliki milikku mimpi mimpiku minal muda mulia mungkin musafir musim mustika mutiara nak nama namamu namun
  nanti nggak niat nina nota nurani nyanyian oleh orang pada padaku padamu pagi pahit pahlawan pandang pantai
  parah pasti pejam penantian pengganti perantau perasaan percaya percintaan pergi perindu perjalanan perjuangan
  pernah perpisahan persinggahan pertama pertemuan pesan pintu pisah pohon puisi pujaan pujuk pulang punya
  purnama puteri putih rahasia rahsia raikan ramadhan rampas rapuh rasa raya rayuan rela relaku renungkanlah
  restu retak riang rimba rindu rinduku rindumu rindunya rumah sabar sahaja saja sakti salam saling salju
  sambutlah sampai sandiwara sangka sari sayang sayangi sayangku sayap seandainya sebab sebelum sebenarnya
  sebuah sedih segalanya segi sejak sejati sejuta sekali sekeping seksa sekuntum selalu selamanya selamat
  selatan semakin semalam semangat sempurna semua sendiri seniman senja senyum seorang sepasang sepenuh seperti
  sepi seribu serindu seroja sesat setahun setelah setia siapa sih sinar sini sketsa srikandi suara suasana
  suatu suci sudah sudi sunyi suratan syahdu syawal syukur syurga tahu tahun tak takbir takdir takkan taman
  tanah tanpa tanya tapi tasik teganya teman tenang tentang tepi terakhir terasing teratai terbaik terbang
  terhenti terima terindah terluka ternyata terpaksa terpukau terserlah tersiksa terukir tetap tetapi tiada tiba
  tidak tika tinggal tirai titian tua tuhan tulang tunggu ucap ujung umpama undurkan untuk untukku untukmu usang
  wajah wajahmu waktu wal walau walaupun wanita yang
`);
const ENGLISH_WORDS = setOf(`
  about again all alone and are away baby back bad be boy can can't come dance don't down dream everybody
  everything feel fire for forever from get girl give go gonna good got heart home i i'm in into is it it's just
  know left let life light like little love make me my need never night no nothing of oh on one only out over
  right run running say stay still take tell that the think this time to together tonight up wanna want was way
  we what when will with world yeah you you're your
`);
const OTHER_WORDS = setOf(`
  alma amigo amor amore au auf aux avec avoir bailar belle beso besos bien bist c'est canción ce che coeur com
  comme como con corazon corazón coração cuore cœur dans das dei del della delle der des dich die dos du día ein
  eine el ela ele elle elles encore engel eres est esta está et eu fait fille garçon grand grande hast hasta
  herz ich ihr il ils immer ist j'ai je jour kein keine l'amour las le leben les leur liebe los ma mais mein mes
  meu mich minha mis mit moi mon monde mort mujer mundo nacht nada nicht noche non notte nous nuit nunca não oui
  où para pas per petit petite plus por pour quand que qui quiero rien rêve rêves sa sans sono ta gente fin camino verano creo un saudade schön sem sich
  siempre sobre soleil sonne sont sur t'aime tempo teu todo toi ton tout tu tudo tus uma una und une vida vie
  vita você vous welt wie wieder wir yo zu être
`);
// Spanish words that are also Malay, Indonesian or English words: they count half.
const WEAK_OTHER_WORDS = setOf('mi sin dia re');
const otherWordCount = (list) => count(list, OTHER_WORDS) + count(list, WEAK_OTHER_WORDS) / 2;
const INDONESIAN_ONLY = setOf(`
  aja banget bareng bisa cewek cowok deh doang dong emang gak gimana gue kamu kangen kayak kok lo lu mau nggak
  pacar sih udah
`);
const MALAYSIAN_ONLY = setOf(`
  bagaimana boleh engkau hendak kau kerana kerna mahu sahaja sangat tak takkan
`);
const JAPANESE_WORDS = setOf(`
  ai aki ame arigatou asa boku da dake de desu e egao fuyu ga hana haru hoshi ka kara kaze kimi kimochi koi
  kokoro made mirai mo nai namida natsu ne ni no ore sakura sayonara sekai shite sora to tsuki umi wa watashi wo
  yo yoru yume
`);

// ---- instrumental music ----
const INSTRUMENTAL_TITLE =
  /[(\[](?:[^)\]]*\b)?(?:instrumental|inst\.?|karaoke|off vocal|music box|orgel|piano ver(?:sion|\.)?|伴奏)(?:\b[^)\]]*)?[)\]]|\b(?:instrumental version|karaoke version|off vocal|music box version|backing track)\b|伴奏|純音樂|纯音乐|オルゴール|インスト|^instrumental$/i;
const INSTRUMENTAL_NAME =
  /\b(?:lo-?fi|chillhop|instrumental|meditation|meditative|spa music|zen music|asian zen|relaxing|relaxation|sleep music|sleeping music|sleep songs|deep sleep|study music|yoga|koto|shakuhachi|guzheng|erhu|karaoke|bgm|white noise|binaural|healing music|music box|orgel|chillout lounge|piano tribute|piano collection|piano covers|anime no piano|piano dreamers|violin covers?|solo piano|nature sounds?|beats to)\b|piano(?=\s*$)|オルゴール|純音樂|纯音乐/i;

// ---- marks in the title ----
const VERSION_MARKS = [
  [/japanese (?:ver|version)|日本語/i, 'ja'],
  [/korean (?:ver|version)|한국어/i, 'ko'],
  [/english (?:ver|version)|eng ver/i, 'en'],
  [/mandarin|國語|国语|\(國\)|chinese (?:ver|version)|中文版/i, 'zh'],
  [/cantonese|粵語|粤语|\(粵\)|\(粤\)/i, 'yue'],
  [/hokkien|台語|台语|閩南|闽南/i, 'other'], // Taiwanese Hokkien is not offered
  [/motivational speech/i, 'en'],
];
const versionMark = (title) => VERSION_MARKS.find(([pattern]) => pattern.test(String(title ?? '')))?.[1] ?? null;

// Japanese written in Latin letters ("Sonohiwa Kanarazu Kuru").
const ROMAJI_WORD = /^(?:(?:[kgsztdnhbpmrwfjv]|ky|gy|sh|ch|ts|ny|hy|by|py|my|ry|j)?[aiueo]|n|[kstpgdbmc](?=[kstpgdbmc]))+$/;
function isRomaji(title) {
  const list = words(mainTitle(title)).filter((word) => word.length > 1 || word === 'e');
  if (list.length < 2) return list.length === 1 && list[0].length >= 6 && ROMAJI_WORD.test(list[0]) && !ENGLISH_WORDS.has(list[0]);
  const romaji = list.filter((word) => ROMAJI_WORD.test(word));
  return (
    romaji.length === list.length &&
    (list.some((word) => JAPANESE_WORDS.has(word)) || romaji.some((word) => word.length >= 5)) &&
    count(list, ENGLISH_WORDS) <= Math.floor(list.length / 3)
  );
}

// Language from the writing system alone; null for the Latin alphabet.
// "han" (Chinese characters) is returned as chineseHint (Japanese also uses them).
export function scriptLanguage(text, chineseHint = 'zh') {
  const value = String(text ?? '');
  if (HANGUL.test(value)) return 'ko';
  if (KANA.test(value)) return 'ja';
  if (HAN.test(value)) return chineseHint;
  if (OTHER_SCRIPT.test(value)) return 'other';
  return null;
}
const scriptOf = (...texts) => scriptLanguage(texts.filter(Boolean).join(' '), 'han');

// ---- ISRC: country and label ----
const ASIAN_COUNTRIES = { JP: 'ja', KR: 'ko', KS: 'ko', HK: 'yue', MO: 'yue', TW: 'zh', CN: 'zh', MY: 'ms', ID: 'id' };
const OTHER_ASIAN_COUNTRIES = new Set('TH VN IN PK BD LK PH TR RU UA IL AE SA EG IR KZ MN NP MM KH'.split(' '));
const ENGLISH_COUNTRIES = new Set(['US', 'GB', 'UK', 'CA', 'AU', 'IE', 'NZ']);
// Labels (first 5 letters of the ISRC) outside Asia that release songs in one
// Asian language, e.g. JYP's and HYBE's US labels (Korean). They count only for
// songs found in that language's playlists, because they also release Western music.
const LABEL_LANGUAGES = {
  US5TA: 'ko', USA2P: 'ko', ZZA0P: 'ko', GB32E: 'ko', USQ5M: 'ko', QZEKE: 'ko', QZF45: 'ko', SGA03: 'ms',
};
// Labels that release lo-fi beats (no singing) found in Japanese playlists.
const LOFI_LABELS = new Set(['US3DF', 'QM3DF', 'USANG', 'QMANG']);
// ISRCs from music distributors that anyone can use say nothing about the language.
const isDistributorCountry = (country) => country[0] === 'Q' || ['TC', 'DG', 'GX', 'ZZ', 'BX', 'FX', 'BC', 'DC', 'CB', 'XX'].includes(country);

// Other distributors: labels with many artists, most of them found in non-English playlists.
export function findDistributors(songs, isrcs) {
  const labels = new Map();
  for (const song of songs) {
    const isrc = isrcs.get(song.id);
    if (!isrc || song.foundIn.includes('muse')) continue;
    const prefix = isrc.slice(0, 5).toUpperCase();
    const label = labels.get(prefix) ?? { songs: 0, english: 0, artists: new Set() };
    label.songs += 1;
    if (song.foundIn.length === 1 && song.foundIn[0] === 'en') label.english += 1;
    label.artists.add(artistKey(song.artist));
    labels.set(prefix, label);
  }
  const result = new Set();
  for (const [prefix, label] of labels) {
    if (label.artists.size >= 15 && label.english / label.songs < 0.6 && !LABEL_LANGUAGES[prefix] && !LOFI_LABELS.has(prefix)) result.add(prefix);
  }
  return result;
}

// What a song's ISRC says: { kind: 'asia', language } | { kind: 'lofi' } |
// { kind: 'english' | 'western' | 'other-asia' | 'singapore', country } | { kind: null }
export function isrcSignal(isrc, foundIn = [], distributors = new Set()) {
  if (!isrc) return { kind: null };
  const code = String(isrc).toUpperCase();
  const prefix = code.slice(0, 5);
  const country = code.slice(0, 2);
  if (LABEL_LANGUAGES[prefix]) return foundIn.includes(LABEL_LANGUAGES[prefix]) ? { kind: 'asia', language: LABEL_LANGUAGES[prefix] } : { kind: null };
  if (LOFI_LABELS.has(prefix)) return { kind: 'lofi' };
  if (code.startsWith('TCJP')) return { kind: 'asia', language: 'ja' }; // TuneCore Japan
  if (ASIAN_COUNTRIES[country]) return { kind: 'asia', language: ASIAN_COUNTRIES[country] };
  if (isDistributorCountry(country) || distributors.has(prefix)) return { kind: null };
  if (country === 'SG') return { kind: 'singapore', country };
  if (ENGLISH_COUNTRIES.has(country)) return { kind: 'english', country };
  if (OTHER_ASIAN_COUNTRIES.has(country)) return { kind: 'other-asia', country };
  return { kind: 'western', country };
}

const onlyIn = (foundIn, allowed) => foundIn.every((language) => allowed.includes(language));
const add = (tally, key, amount) => (tally[key] = (tally[key] ?? 0) + amount);
const top = (tally) => Object.entries(tally).reduce((best, entry) => (entry[1] > best[1] ? entry : best), [null, -Infinity])[0];

// What all songs of each artist say together.
function artistProfiles(songs, signals) {
  const profiles = new Map();
  for (const song of songs) {
    const key = artistKey(song.artist);
    const profile = profiles.get(key) ?? { songs: 0, votes: {}, playlists: {}, countries: {}, other: 0, english: 0, albumInstrumental: 0, hongKong: { yue: 0, zh: 0 }, sure: 0 };
    profiles.set(key, profile);
    profile.songs += 1;
    const { foundIn } = song;
    for (const language of foundIn) add(profile.playlists, language, 1);
    const script = scriptOf(song.title, song.album, song.artist);
    if (script) add(profile.votes, script, 3);
    const signal = signals.get(song.id);
    if (script || signal.kind === 'asia') profile.sure += 1; // more than a playlist says where the artist is from
    if (signal.kind === 'asia') {
      // Hong Kong, Taiwan and China labels also release Korean and Japanese
      // music there: they count less for songs not in a Chinese playlist.
      const chineseLabelOnly = CHINESE.includes(signal.language) && !foundIn.some((language) => CHINESE.includes(language));
      add(profile.votes, signal.language, chineseLabelOnly ? 0.5 : 2);
      add(profile.countries, signal.language, 1);
    }
    if (signal.kind === 'english') add(profile.votes, 'en', 1);
    if (signal.kind === 'western') add(profile.votes, 'west', 1);
    if (signal.kind === 'other-asia') add(profile.votes, 'other', 1);
    for (const language of foundIn) add(profile.votes, language === 'muse' ? 'en' : language, language === 'muse' ? 1 : 0.5);
    const titleWords = words(mainTitle(song.title));
    const english = count(titleWords, ENGLISH_WORDS);
    const malay = count(titleWords, MALAY_WORDS);
    if (!english && otherWordCount(titleWords) >= 1) profile.other += 1;
    if (english) profile.english += 1;
    if (malay && malay > english && (foundIn.includes('ms') || malay >= 2)) add(profile.votes, 'ms', 2);
    if (INSTRUMENTAL_NAME.test(song.album ?? '')) profile.albumInstrumental += 1;
    // Hong Kong labels release Cantonese and Mandarin songs: which playlists hold this artist's?
    if (String(song.isrc ?? '').toUpperCase().startsWith('HK') && !foundIn.includes('muse')) {
      if (foundIn.includes('yue')) profile.hongKong.yue += 1;
      else if (foundIn.includes('zh')) profile.hongKong.zh += 1;
    }
  }
  for (const profile of profiles.values()) profile.home = homeLanguage(profile);
  return profiles;
}

// The language most of an artist's evidence points to. "west": a Western label,
// language unknown (many European artists sing in English).
function homeLanguage(profile) {
  const votes = { ...profile.votes };
  if (votes.han) {
    const han = votes.han;
    delete votes.han;
    const chinese = CHINESE.filter((language) => profile.playlists[language]);
    if ((votes.ja ?? 0) >= Math.max(votes.zh ?? 0, votes.yue ?? 0, votes.nan ?? 0, 0.1)) add(votes, 'ja', han);
    else if (chinese.length) add(votes, chinese.reduce((best, language) => (profile.playlists[language] > profile.playlists[best] ? language : best)), han);
    else add(votes, (votes.yue ?? 0) > (votes.zh ?? 0) ? 'yue' : 'zh', han);
  }
  const best = top(votes);
  if (best === 'west') return profile.other >= 2 && profile.other >= profile.english ? 'other' : 'west';
  return best;
}

function malayOrIndonesian(profile, title, fallback) {
  const list = words(mainTitle(title));
  const indonesian = list.some((word) => INDONESIAN_ONLY.has(word));
  const malaysian = list.some((word) => MALAYSIAN_ONLY.has(word));
  if (indonesian && !malaysian) return 'id';
  if (malaysian && !indonesian) return 'ms';
  const { id = 0, ms = 0 } = profile.countries;
  if (id > ms) return 'id';
  if (ms > id) return 'ms';
  return fallback;
}

// One song. Returns [language, reason].
function decide(song, profile, signal) {
  const { foundIn, title } = song;
  const home = profile.home;
  const titleWords = words(mainTitle(title));
  const english = count(titleWords, ENGLISH_WORDS);
  const malay = count(titleWords, MALAY_WORDS);
  const other = otherWordCount(titleWords) >= 1;
  const accents = ACCENTS.test(mainTitle(title));
  let { kind } = signal;
  const country = signal.language;

  if (INSTRUMENTAL_TITLE.test(title) || INSTRUMENTAL_NAME.test(song.artist)) return ['instrumental', 'keyword'];
  // Albums called "... Lofi ...", "Relaxing ..." etc.: instrumental when enough of
  // the artist's songs are on such albums (most, for artists known to be from an
  // Asian country; fewer for beat makers known only from Asian playlists).
  const share = profile.albumInstrumental / profile.songs;
  const onlyAsianPlaylists = !profile.playlists.en && !profile.playlists.muse;
  const enough = profile.sure ? 0.6 : onlyAsianPlaylists && profile.albumInstrumental >= 2 ? 0.15 : 0.25;
  if (share >= enough) return ['instrumental', 'keyword'];
  const mark = versionMark(title);
  if (mark) return [mark, 'marker'];

  const chinese = (fromIsrc = null) => {
    const found = ['yue', 'zh'].filter((language) => foundIn.includes(language));
    const { yue, zh } = profile.hongKong;
    // A Cantonese singer's Hong Kong song in a Mandarin playlist.
    if (fromIsrc === 'yue' && found.length === 1 && found[0] === 'zh' && yue / (yue + zh) > 0.5) return 'yue';
    if (found.length) return found[0];
    if (CHINESE.includes(fromIsrc)) return fromIsrc;
    return CHINESE.includes(home) ? home : 'zh';
  };

  let script = scriptOf(title);
  if (!script) {
    const albumScript = scriptOf(song.album);
    if ((albumScript === 'ko' || albumScript === 'ja') && !['en', 'west', 'other'].includes(home)) script = albumScript;
    else if (albumScript === 'han') {
      if (home === 'ko' || home === 'ja') return [home, 'artist+album'];
      if (CHINESE.includes(home) || (kind === 'asia' && CHINESE.includes(country))) script = 'han';
    }
  }
  if (script === 'ko' || script === 'ja' || script === 'other') return [script, 'script'];
  if (script === 'han') {
    const asianIsrc = kind === 'asia' ? country : null;
    if (asianIsrc === 'ja' || (home === 'ja' && ![...CHINESE, 'ms', 'id'].includes(asianIsrc))) return ['ja', 'script'];
    return [chinese(asianIsrc), 'script'];
  }
  if (kind === 'lofi' && onlyIn(foundIn, ['ja', 'en'])) return ['instrumental', 'lofi-label'];
  // A Western artist's song released by an Asian label (e.g. a live album recorded there).
  if (kind === 'asia' && onlyIn(foundIn, ['en', 'muse']) && ['en', 'west', 'other'].includes(home)) kind = null;
  // A Korean or Japanese artist's song released by a Hong Kong, Taiwan or China label.
  if (kind === 'asia' && CHINESE.includes(country) && ['ko', 'ja', 'ms', 'id'].includes(home) && !foundIn.some((language) => CHINESE.includes(language))) kind = null;
  if (kind === 'asia') {
    if (CHINESE.includes(country)) return [chinese(country), 'isrc'];
    if (country === 'ms' || country === 'id') return english >= 2 && malay === 0 ? ['en', 'isrc+title'] : [country, 'isrc'];
    if (country === 'ko' && home === 'ja') return ['ja', 'artist'];
    return [country, 'isrc']; // e.g. a K-pop group's Japanese release: Japanese
  }
  if (kind === 'other-asia') return [english ? 'en' : 'other', 'isrc'];
  if (kind === 'singapore' && (foundIn.includes('ms') || malay)) return [malayOrIndonesian(profile, title, 'ms'), 'isrc'];
  // A real Western label and no Asian playlist: trust it over an artist with the same name.
  if (kind === 'english' && onlyIn(foundIn, ['en', 'muse'])) return [(other || accents) && !english ? 'other' : 'en', 'isrc'];
  // Only playlists point to an Asian language, but the title is French, Spanish...
  if (!profile.sure && !english && !malay && (other || accents) && home !== 'en') return ['other', 'words'];
  if (home === 'ko' || home === 'ja') return [home === 'ko' && isRomaji(title) ? 'ja' : home, 'artist'];
  if (CHINESE.includes(home)) return [chinese(), 'artist'];
  if (home === 'ms' || home === 'id') return english >= 2 && malay === 0 ? ['en', 'title'] : [malayOrIndonesian(profile, title, home), 'artist'];
  if (malay >= 1 && malay > english && (foundIn.includes('ms') || malay >= 2) && !other) return [malayOrIndonesian(profile, title, 'ms'), 'words'];
  if (home === 'other' && !english) return ['other', 'artist'];
  if (other && !english) return ['other', 'words'];
  if (accents && !english && !malay) return ['other', 'words'];
  if (isRomaji(title) && foundIn.includes('ja')) return ['ja', 'romaji'];
  return ['en', 'default'];
}

// A quick guess for one song on its own (used while importing; the full
// labelling with all songs and ISRCs runs afterwards).
export function detectLanguage(song) {
  const { songs } = labelLanguages([song]);
  return songs[0].language;
}

// Gives every song its language.
//   songs: { id, title, artist, album, language?, found_in? (playlist languages), isrc? }
//   isrcs: Map of song id -> ISRC (songs may also carry .isrc)
//   museIds: ids of songs from the MuSe research dataset (Western listeners)
//   extraWesternArtists: artists known from MuSe (counted like a MuSe song)
export function labelLanguages(songs, { isrcs = new Map(), museIds = new Set(), extraWesternArtists = [] } = {}) {
  const prepared = songs.map((song) => {
    const playlists = (song.foundIn ?? song.found_in ?? []).filter((language) => !RETIRED.includes(language));
    const isrc = song.isrc ?? isrcs.get(song.id) ?? null;
    return { ...song, isrc, foundIn: museIds.has(song.id) ? [...playlists, 'muse'] : playlists };
  });
  const extra = extraWesternArtists.map((artist, index) => ({ id: `muse-artist-${index}`, title: '', artist, foundIn: ['muse'] }));
  const all = [...prepared, ...extra];
  const isrcMap = new Map(all.filter((song) => song.isrc).map((song) => [song.id, song.isrc]));
  const distributors = findDistributors(all, isrcMap);
  const signals = new Map(all.map((song) => [song.id, isrcSignal(song.isrc, song.foundIn, distributors)]));
  const profiles = artistProfiles(all, signals);
  const changes = [];
  const reasons = {};
  const labelled = prepared.map(({ foundIn, isrc: _isrc, ...song }) => {
    const [language, reason] = decide({ ...song, foundIn }, profiles.get(artistKey(song.artist)), signals.get(song.id));
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    if (song.language && song.language !== language) changes.push({ id: song.id, from: song.language, to: language, example: `${song.artist} – ${song.title}` });
    const playlists = foundIn.filter((item) => item !== 'muse');
    const { found_in: _saved, foundIn: _given, ...rest } = song;
    return playlists.length ? { ...rest, language, found_in: playlists } : { ...rest, language };
  });
  return { songs: labelled, changes, reasons };
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
