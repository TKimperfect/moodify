// Works out which language each song is sung in. (Cantonese is told apart
// from Mandarin internally, from Hong Kong labels and playlists, but both are
// labelled "zh", Chinese.) Playlists mix languages
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
// Malay and Indonesian build words from a root: "merindukanmu" = me + rindu + kan + mu.
const MALAY_PREFIXES = /^(?:memper|diper|meng|meny|mem|men|ber|ter|per|me|di|ke|se)/;
const MALAY_SUFFIXES = /(?:kannya|kanlah|kanku|kanmu|annya|kan|nya|lah|kah|an|ku|mu)$/;
function isMalayWord(word) {
  if (MALAY_WORDS.has(word)) return true;
  if (word.length < 6) return false;
  const candidates = new Set();
  const noSuffix = word.replace(MALAY_SUFFIXES, '');
  for (const base of [word, noSuffix]) {
    candidates.add(base.replace(MALAY_PREFIXES, ''));
    candidates.add(base);
  }
  return [...candidates].some((root) => root !== word && root.length >= 4 && MALAY_WORDS.has(root));
}
const countMalay = (list) => list.filter(isMalayWord).length;
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
  adentro agora agua alles amanhã amigo amo amor amore amour ancora aqui au auf aux avec avoir bailar bambina
  beijo beso besos bien bist c'est camino canción canzone ce cette che chez ciao ciel cielo coeur coisa com
  comme como con corazon corazón coração cosa creo cuando cuore cœur dans das dei dein deine del della delle
  demain der des dich dios doch dolce donde dos du día dónde ein eine einem einen el ela ele elles enfant engel
  eres est esta está et eu fait fille fin frau garçon gehen gente giorno gli grazie hast hasta herz heute hier
  homme ich ihr il ils immer insieme io isso ist j'ai j'suis j'te jahre jamais je jour kein keine kinder kommen
  kommt l'amour las le leben les leur liebe los ma mais mann mein meine menina mes meu mich minha mis mit moi
  mon monde morgen mort mujer mulher mundo mädchen nacht nada nein nella nicht nichts niente noche noite nossa
  nosso nostra nostro notte nous nuit nunca não ohne ojos oui où para parce pareil parole pas per perché perdida
  perdido petit petite por porque pour pourquoi quand que quella querer questa questo qui quiero ragazza rara
  rien rêve rêves sa saudade saudades schwarz schwarzen schön sei sem sempre sento sera siamo sich siempre sobre
  soleil solitudine sonho sonne sono sont sorte stunde sueño sueños sulla sur t'aime t'es ta tempo teu ti tiempo
  tierra todo toi ton toujours tout tu tudo tuo tus tutti tutto tête uma un una und une unter uomo verano vida
  vie ville vita você voglio vom votre vous vuoi warum welt wenn wie wieder wir y'a yo zeit zu zum zur zusammen
  ça été être über
`);
// Words that are also Malay, Indonesian or English words or names ("Encore", "Die", "Bella"): they count half.
const WEAK_OTHER_WORDS = setOf('mi sin dia re mas pra pro ella den dem mia mio donna bella bello femme notre grand grande non plus sans die alma elle belle encore');
const otherWordCount = (list) => count(list, OTHER_WORDS) + count(list, WEAK_OTHER_WORDS) / 2;
// Words used in one of the two only ("kau", "tak", "cinta"... are used in both).
const INDONESIAN_ONLY = setOf(`
  aja banget bareng bisa cewek cowok deh doang dong emang gak gimana gue karena kangen kayak kok lo lu nggak
  pacar sih udah
`);
const MALAYSIAN_ONLY = setOf(`
  awak hendak kerana kerna mahu nak sahaja
`);
const JAPANESE_WORDS = setOf(`
  ai akai aki akuma ame anata aoi arigatou asa boku da daisuki dake de densha desu e egao fuyu ga hana hanabi
  haru hikari hito hoshi inochi ka kage kaimono kami kanashii kara kawaii kaze kibou kimi kimochi kioku kirei
  kiseki kitsune koe koi kokoro kuroi kyoku machi made matsuri mirai mo mura nai naki namida natsu ne ni no
  omoide oni ore sabishii sakura sayonara sekai sekaiichi shiawase shinjitsu shiroi shite sora suki tenshi to
  tomodachi tsuki umi unmei ureshii uta wa watashi wo yasashii yo yoru yuki yume zetsubou
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
  // In brackets or as "... version", so titles like "Mandarin Beach" do not count.
  [/[(\[（][^)\]）]*(?:mandarin|國語|国语|普通話|普通话)[^)\]）]*[)\]）]|(?:mandarin|chinese) (?:ver|version)|國語版|国语版|中文版|\(國\)/i, 'zh'],
  [/[(\[（][^)\]）]*(?:cantonese|粵語|粤语)[^)\]）]*[)\]）]|cantonese (?:ver|version)|粵語版|粤语版|\((?:粵|粤|yue)\)/i, 'yue'],
  [/[(\[（][^)\]）]*(?:hokkien|台語|台语|閩南語|闽南语)[^)\]）]*[)\]）]|hokkien (?:ver|version)|台語版|台语版/i, 'other'], // Taiwanese Hokkien is not offered
  [/motivational speech/i, 'en'],
  // Just the language in brackets: "The End (Korean)".
  [/[(\[（](?:korean|한국어)[)\]）]/i, 'ko'],
  [/[(\[（](?:japanese|日本語)[)\]）]/i, 'ja'],
  [/[(\[（]english[)\]）]/i, 'en'],
];

// Artists the rules above cannot place, checked by hand (web searches in
// November 2026, or well-known artists). A value with a playlist applies only
// to songs found in that playlist, for names that other artists share.
const CHECKED_ARTISTS = {
  // In Japanese playlists, but not sung in Japanese
  'la sad': 'other', // Italian band
  kamaitachi: { language: 'other', playlist: 'ja' }, // the Brazilian rapper (not the Japanese band)
  rattlehead: 'en', // American thrash metal band
  'illusion force': 'en', // Japanese band, English lyrics
  'foreground eclipse': 'en', // Japanese band, English lyrics
  metalucifer: 'en', // Japanese band, English lyrics
  'nattalia sarria': 'other', // city pop covers in Spanish
  kordhell: 'en', // phonk with English vocal samples
  'derek fiechter': 'instrumental',
  'brandon fiechter': 'instrumental',
  stapes: 'instrumental',
  'friedrich habetler': 'instrumental', // piano covers
  'samuel kim': 'instrumental', // orchestral covers
  'chasing mirrors': 'instrumental',
  kicktracks: 'instrumental', // stock music
  'mc orsen': 'instrumental', // drift phonk
  nueki: 'instrumental',
  'phonk walker': 'instrumental',
  'ghostface playa': 'instrumental',
  moondeity: 'instrumental',
  'suave lee': 'instrumental',
  xxanteria: 'other', // Brazilian funk
  'dj ikeraus': 'other',
  bellyjay: 'other',
  // Checked: sung in Japanese or Korean, though nothing in the song data says so
  garnidelia: 'ja',
  'release hallucination': 'ja', // melodies written for Japanese lyrics
  chthonic: 'other', // Taiwanese band singing in Taiwanese Hokkien
  snapline: 'en', // Beijing post-punk, English lyrics
  'blood stain child': 'en',
  'significant point': 'en', // Japanese heavy metal, lyrics in English
  nemophila: 'ja', // also on its U.S. releases
  necronomidol: 'ja',
  'scarlet valse': 'ja', // visual kei band
  'mai yajima': 'ja',
  akano: 'ja', // Japanese anime cover singer
  yurisa: 'ja',
  rainych: 'ja', // sings Japanese covers
  'arise in stability': 'ja', // Japanese lyrics
  'aunt sally': 'ja',
  'michiya mihashi': 'ja',
  badcupid: 'ko',
  'kuang program': 'ko',
  // Western bands singing in English that nothing in the song data shows
  'michael learns to rock': 'en',
  'hong kong syndikat': 'en',
  'kurt maloo': 'en',
  double: { language: 'en', playlist: 'yue' }, // the Swiss band
  'the joubert singers': 'en',
  'killswitch engage': 'en',
  'against the current': 'en',
  'vanilla sky': { language: 'en', playlist: 'ms' }, // the Italian band
  'kowloon cowboy': 'en',
  // In Korean playlists, but sung in English
  '...whatever that means': 'en', // Seoul punk band with an international line-up
  hybs: 'en', // Thai duo singing in English
  'hannah bahng': 'en', // Australian singer
  'k/da': 'en',
  'jesse barrera': 'en',
  'resist and exist': 'en',
  // Chinese playlists
  'bliss-illusion': 'zh', // Beijing band, Chinese lyrics
  hiperson: 'zh', // Chengdu band, Chinese lyrics
  zuriaake: 'zh', // lyrics from classical Chinese poetry
  'joi cai chun jia': 'zh', // Joi Chua, Singaporean Mandopop
  'tengger cavalry': 'other', // Mongolian
  'nine treasures': 'other',
  suld: 'other',
  'ego fall': 'other', // Inner Mongolia, sings in Mongolian and Mandarin
  'be persecuted': 'zh', // Nanchang black metal, Chinese lyrics
  holyarrow: 'zh', // Xiamen black metal about Chinese history
  'vengeful spectre': 'zh', // Guangdong black metal about Chinese folklore
  nihility: 'zh', // Changchun metal band, Chinese song titles
  'gao qi & overload': 'zh', // Beijing rock band Overload
  // Korean playlists
  'j rabbit': 'ko', // Korean acoustic duo
  'food for worms': 'en', // Daegu punk band with an American singer
  'dpr ian': 'en',
  jambinai: 'instrumental', // Korean post-rock
  // Japanese playlists
  'elijah nang': 'instrumental', // London lo-fi producer
  'jt music': 'en', // American rap group
  shiitaki: 'instrumental', // lo-fi
  nogymx: 'instrumental',
  mujo: 'instrumental',
  'eddie van der meer': 'instrumental', // guitar covers
  'hikaru station': 'en', // sings English versions of anime songs
  'takamachi walk': 'en', // Touhou metalcore circle from Atlanta
  'ted park': 'en', // American singer
  // Western artists the word lists place wrongly
  'astor piazzolla': 'instrumental',
  vangelis: 'instrumental',
  'ólafur arnalds': 'instrumental',
  'víkingur ólafsson': 'instrumental',
  'marc antoine': 'instrumental',
  'penguin cafe orchestra': 'instrumental',
  'year of no light': 'instrumental',
  'venetian snares': 'instrumental',
  colleen: 'instrumental',
  'the hsu-nami': 'instrumental',
  'pet shop boys': 'en',
  'warren zevon': 'en',
  'the avett brothers': 'en',
  'vivian stanshall': 'en',
  "gigi d'agostino": 'en',
  'neto reyno': 'other', // Mexican rap
  'mr. yosie locote': 'other',
  'kany garcía': 'other', // Puerto Rico, Spanish
  'luedji luna': 'other', // Brazil
  'humood alkhudher': 'other', // Kuwaiti nasheed, Arabic
  // Moluccan (Ambon) singers in Malay playlists: Indonesian
  'antonny rangkoly': 'id',
  'benny fasak': 'id',
  'kevins syahailatua': 'id',
  'lady soul & suara maluku band': 'id',
  'moluccan moods orchestra': 'id',
  bg: { language: 'id', playlist: 'ms' },
  // Malaysian singers released without Malaysian codes
  'amy search': 'ms',
  'ayda jebat': 'ms',
  'jalil hamid': 'ms',
  'aisyah aziz': 'ms',
  'liyana jasmay': 'ms',
  'firdaus rahmat': 'ms',
  'ronnie hussein': 'ms',
};
function checkedLanguage(song) {
  const entry = CHECKED_ARTISTS[artistKey(song.artist)];
  if (!entry) return null;
  if (typeof entry === 'string') return entry;
  return song.foundIn.includes(entry.playlist) ? entry.language : null;
}
const versionMark = (title) => VERSION_MARKS.find(([pattern]) => pattern.test(String(title ?? '')))?.[1] ?? null;

// Japanese written in Latin letters ("Sonohiwa Kanarazu Kuru").
// Syllables (ka, shi, tsu, nyo...), "n", and doubled consonants as Japanese
// spells them (kk, tt, pp, tch, mb/mp): "Redemption" or "Shotgun" do not match.
const ROMAJI_WORD = /^(?:(?:[kgsztdnhbpmrwfjv]|ky|gy|sh|ch|ts|ny|hy|by|py|my|ry|j)?[aiueo]|n|([kstpgdbs])(?=\1)|t(?=ch)|m(?=[bp]))+$/;
// strict: several words, one of them a common Japanese word ("Ai no Uta"), so
// that English words shaped like Japanese ("Attitude", "Baddie") do not count.
function isRomaji(title, { strict = false } = {}) {
  const list = words(mainTitle(title)).filter((word) => word.length > 1 || word === 'e');
  // (a single long word like "katachinonaihana" counts too)
  if (strict && list.length === 1) return list[0].length >= 10 && ROMAJI_WORD.test(list[0]);
  if (strict && !list.some((word) => JAPANESE_WORDS.has(word))) return false;
  if (list.length < 2) return list.length === 1 && list[0].length >= 6 && ROMAJI_WORD.test(list[0]) && !ENGLISH_WORDS.has(list[0]);
  const romaji = list.filter((word) => ROMAJI_WORD.test(word));
  return (
    romaji.length === list.length &&
    (list.some((word) => JAPANESE_WORDS.has(word)) || romaji.some((word) => word.length >= 5)) &&
    count(list, ENGLISH_WORDS) <= Math.floor(list.length / 3)
  );
}

// Mandarin written in pinyin ("Yi Hou Bie Zuo Peng You"), as Deezer often shows Chinese titles.
const PINYIN_WORD =
  /^(?:[bpmfdtnlgkhjqxrzcsyw]|zh|ch|sh)?(?:iang|iong|uang|ueng|ang|eng|ing|ong|ian|iao|uai|uan|van|ai|ei|ao|ou|an|en|in|un|vn|er|ia|ie|iu|ua|uo|ui|ue|ve|a|o|e|i|u|v)$/;
function isPinyin(title) {
  const list = words(mainTitle(title));
  return list.length >= 2 && list.every((word) => PINYIN_WORD.test(word)) && count(list, ENGLISH_WORDS) <= Math.floor(list.length / 3);
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
// (AE is left out: distributors in the Emirates release music from everywhere.)
const OTHER_ASIAN_COUNTRIES = new Set('TH VN IN PK BD LK PH TR RU UA IL SA EG IR KZ MN NP MM KH'.split(' '));
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
  // TuneCore Japan, also used by Chinese and Malaysian indie bands.
  if (code.startsWith('TCJP')) return foundIn.some((language) => ['zh', 'yue', 'ms'].includes(language)) ? { kind: null } : { kind: 'asia', language: 'ja' };
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
    const profile = profiles.get(key) ?? { songs: 0, votes: {}, playlists: {}, countries: {}, other: 0, english: 0, albumInstrumental: 0, hongKong: { yue: 0, zh: 0 }, sure: 0, chinese: 0, singapore: 0, malay: 0, englishLabel: 0, museEnglishLabel: 0 };
    profiles.set(key, profile);
    profile.songs += 1;
    const { foundIn } = song;
    for (const language of foundIn) add(profile.playlists, language, 1);
    const script = scriptOf(song.title, song.album, song.artist);
    if (script) add(profile.votes, script, 3);
    const signal = signals.get(song.id);
    if (script || signal.kind === 'asia') profile.sure += 1; // more than a playlist says where the artist is from
    // Anything besides a playlist that says the artist sings in Chinese.
    if (script === 'han' || (signal.kind === 'asia' && CHINESE.includes(signal.language)) || isPinyin(song.title)) profile.chinese += 1;
    if (signal.kind === 'asia') {
      // Hong Kong, Taiwan and China labels also release Korean and Japanese
      // music there: they count less for songs not in a Chinese playlist.
      const chineseLabelOnly = CHINESE.includes(signal.language) && !foundIn.some((language) => CHINESE.includes(language));
      add(profile.votes, signal.language, chineseLabelOnly ? 0.5 : 2);
      add(profile.countries, signal.language, 1);
    }
    if (signal.kind === 'english') {
      add(profile.votes, 'en', 1);
      profile.englishLabel += 1;
      if (foundIn.includes('muse')) profile.museEnglishLabel += 1;
    }
    if (signal.kind === 'western') add(profile.votes, 'west', 1);
    if (signal.kind === 'other-asia') add(profile.votes, 'other', 1);
    if (signal.kind === 'singapore') profile.singapore += 1;
    const titleWords = words(mainTitle(song.title));
    const english = count(titleWords, ENGLISH_WORDS);
    const malay = countMalay(titleWords);
    if (!english && (otherWordCount(titleWords) >= 1 || ACCENTS.test(mainTitle(song.title)))) profile.other += 1;
    if (english) profile.english += 1;
    if (malay && malay > english && (foundIn.includes('ms') || malay >= 2)) add(profile.votes, 'ms', 2);
    if (malay && malay >= english) profile.malay += 1;
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
  // Playlists: MuSe counts as English. Chinese playlists count only when
  // something else says the artist sings in Chinese (they also hold French
  // rap, Western hits and English songs by Asian artists).
  // Malay playlists likewise need Malay or Indonesian words in a title, or a
  // Malaysian, Indonesian or Singapore label.
  const malayEvidence = profile.malay || profile.singapore || profile.countries.ms || profile.countries.id;
  for (const [language, times] of Object.entries(profile.playlists)) {
    if (language === 'muse') add(votes, 'en', times);
    else if (CHINESE.includes(language) && !profile.chinese) continue;
    else if (language === 'ms' && !malayEvidence) continue;
    else add(votes, language, times * 0.5);
  }
  if (votes.han) {
    const han = votes.han;
    delete votes.han;
    const chinese = CHINESE.filter((language) => profile.playlists[language]);
    if ((votes.ja ?? 0) >= Math.max(votes.zh ?? 0, votes.yue ?? 0, votes.nan ?? 0, 0.1)) add(votes, 'ja', han);
    else if (chinese.length) add(votes, chinese.reduce((best, language) => (profile.playlists[language] > profile.playlists[best] ? language : best)), han);
    else add(votes, (votes.yue ?? 0) > (votes.zh ?? 0) ? 'yue' : 'zh', han);
  }
  const best = top(votes);
  const foreign = profile.other >= 2 && profile.other >= profile.english;
  if (best === 'west' || ((best === null || best === 'en') && !profile.playlists.muse)) return foreign ? 'other' : best;
  return best;
}

// When neither the title nor the artist's labels tell: Malaysian
// singers nearly always have Malaysian (MY) or Singapore (SG) codes; Malay
// playlist songs without any are mostly by Indonesian singers released
// through international distributors.
function malayOrIndonesian(profile, title) {
  const list = words(mainTitle(title));
  const indonesian = list.some((word) => INDONESIAN_ONLY.has(word));
  const malaysian = list.some((word) => MALAYSIAN_ONLY.has(word));
  if (indonesian && !malaysian) return 'id';
  if (malaysian && !indonesian) return 'ms';
  const { id = 0, ms = 0 } = profile.countries;
  if (id > ms) return 'id';
  if (ms > id || profile.singapore) return 'ms';
  return 'id';
}

// One song. Returns [language, reason].
function decide(song, profile, signal) {
  const { foundIn, title } = song;
  const home = profile.home;
  const titleWords = words(mainTitle(title));
  const english = count(titleWords, ENGLISH_WORDS);
  const malay = countMalay(titleWords);
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
  const checked = checkedLanguage(song);
  if (checked) return [checked, 'checked'];

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
  // A MuSe song (Western listeners) by an artist whose MuSe songs come from an
  // English-speaking label, while an Asian artist has the same name (Eve).
  if (!kind && foundIn.includes('muse') && profile.museEnglishLabel && [...CHINESE, 'ko', 'ja', 'ms', 'id'].includes(home) && !scriptOf(title)) {
    return [(other || accents) && !english ? 'other' : 'en', 'isrc'];
  }
  // A Korean or Japanese artist's song released by a Hong Kong, Taiwan or China label.
  if (kind === 'asia' && CHINESE.includes(country) && ['ko', 'ja', 'ms', 'id'].includes(home) && !foundIn.some((language) => CHINESE.includes(language))) kind = null;
  if (kind === 'asia') {
    if (CHINESE.includes(country)) return [chinese(country), 'isrc'];
    if (country === 'ms' || country === 'id') return english >= 2 && malay === 0 ? ['en', 'isrc+title'] : [country, 'isrc'];
    return [country, 'isrc']; // e.g. a K-pop group's Japanese release: Japanese
  }
  if (kind === 'other-asia') return [english ? 'en' : 'other', 'isrc'];
  if (kind === 'singapore' && (foundIn.includes('ms') || malay)) return [malayOrIndonesian(profile, title), 'isrc'];
  // A real Western label and no Asian playlist: trust it over an artist with the same name.
  if (kind === 'english' && onlyIn(foundIn, ['en', 'muse'])) return [(other || accents) && !english ? 'other' : 'en', 'isrc'];
  // Only playlists point to an Asian language, but the title is French, Spanish...
  if (!profile.sure && !english && !malay && (other || accents) && home !== 'en') return ['other', 'words'];
  // A song from a Western label (not a distributor) with a Latin title, not in a
  // playlist of the artist's language: another artist with the same name
  // (Gala, LISA / LiSA), or an Asian act's English release found in English playlists.
  const asianName = HANGUL.test(song.artist) || KANA.test(song.artist) || HAN.test(song.artist);
  const homePlaylist = CHINESE.includes(home) ? foundIn.some((language) => CHINESE.includes(language)) : foundIn.includes(home);
  if ((kind === 'english' || kind === 'western') && [...CHINESE, 'ko', 'ja'].includes(home) && !homePlaylist && !isPinyin(title) && !isRomaji(title, { strict: true }) && !asianName) {
    return [(other || accents) && !english ? 'other' : 'en', 'isrc'];
  }
  if (home === 'ko' || home === 'ja') {
    if (home === 'ko' && isRomaji(title, { strict: true })) return ['ja', 'romaji'];
    if (home === 'ja' && isRomaji(title) && words(mainTitle(title)).length >= 2) return ['ja', 'romaji'];
    // Only playlists say so: nothing tells what this artist sings in.
    return profile.sure ? [home, 'artist'] : ['unknown', 'no evidence'];
  }
  if (CHINESE.includes(home)) return [chinese(), 'artist'];
  if (!CHINESE.includes(home) && isPinyin(title) && foundIn.some((language) => CHINESE.includes(language))) return [chinese(), 'pinyin'];
  if (home === 'ms' || home === 'id') return english >= 2 && malay === 0 ? ['en', 'title'] : [malayOrIndonesian(profile, title), 'artist'];
  if (malay >= 1 && malay > english && (foundIn.includes('ms') || malay >= 2) && !other) return [malayOrIndonesian(profile, title), 'words'];
  if (home === 'other' && !english) return ['other', 'artist'];
  if (other && !english) return ['other', 'words'];
  if (accents && !english && !malay) return ['other', 'words'];
  if (isRomaji(title, { strict: true }) && foundIn.includes('ja')) return ['ja', 'romaji'];
  // English: the artist is known from English playlists, MuSe (Western
  // listeners) or an English-speaking label. Otherwise nothing tells.
  if (profile.playlists.en || profile.playlists.muse || profile.englishLabel) return ['en', 'default'];
  // A European label and an English title (e.g. Michael Learns To Rock, Denmark).
  if (english && (kind === 'western' || profile.votes.west)) return ['en', 'title'];
  return ['unknown', 'no evidence'];
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
//   heard: Map of song id -> language heard in the song's audio preview
//     (src/data/heard-languages.json). Used only for songs the rules above
//     leave as "unknown".
export function labelLanguages(songs, { isrcs = new Map(), museIds = new Set(), extraWesternArtists = [], heard = new Map() } = {}) {
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
  const reasonById = new Map();
  const labelled = prepared.map(({ foundIn, isrc: _isrc, ...song }) => {
    let [decided, reason] = decide({ ...song, foundIn }, profiles.get(artistKey(song.artist)), signals.get(song.id));
    if (decided === 'unknown' && heard.has(song.id)) [decided, reason] = [heard.get(song.id), 'heard in the audio preview'];
    // Cantonese and Mandarin share one label, "Chinese" (zh), since 1.2.22.
    const language = decided === 'yue' ? 'zh' : decided;
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    reasonById.set(song.id, reason);
    if (song.language && song.language !== language) changes.push({ id: song.id, from: song.language, to: language, example: `${song.artist} – ${song.title}` });
    const playlists = foundIn.filter((item) => item !== 'muse');
    const { found_in: _saved, foundIn: _given, ...rest } = song;
    return playlists.length ? { ...rest, language, found_in: playlists } : { ...rest, language };
  });
  return { songs: labelled, changes, reasons, reasonById };
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
