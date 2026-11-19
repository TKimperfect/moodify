// Builds a catalogue of real songs in seven languages from Deezer playlists.
// For each language and mood, it searches Deezer for a matching playlist
// (e.g. "粤语 伤感", "lagu melayu sedih") and takes songs from it. The mood and
// language come from the search; energy, tempo and effects are estimated.
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/httpError.js';
import { deriveFromMoods } from '../../data/taxonomy.js';
import { fetchJson } from './providers/http.js';

const q = (text, genre = 'pop') => ({ text, genre });

// Several searches per language and mood, tried in order until one finds a playlist.
export const CATALOG_QUERIES = {
  en: {
    happy: [q('happy songs'), q('feel good hits')], sad: [q('sad songs'), q('heartbreak songs')],
    lonely: [q('lonely songs'), q('alone at night'), q('lonely night songs'), q('sad songs for lonely nights'), q('breakup songs')],
    angry: [q('angry rock', 'rock'), q('rage songs', 'rock')],
    anxious: [q('songs for anxiety', 'indie'), q('calm down anxiety', 'indie')], calm: [q('chill acoustic', 'folk'), q('calm songs', 'folk')],
    nostalgic: [q('throwback hits'), q('nostalgia songs')], motivated: [q('workout motivation'), q('motivation songs')],
    empty: [q('numb songs', 'alternative'), q('sad indie', 'indie')], romantic: [q('love songs'), q('romantic songs')],
  },
  ms: {
    happy: [q('lagu melayu gembira'), q('lagu ceria melayu'), q('malay happy songs'), q('pop melayu'), q('lagu viral malaysia'), q('lagu raya')],
    sad: [q('lagu melayu sedih'), q('lagu sedih malaysia'), q('malay sad songs'), q('lagu sedih')],
    lonely: [q('lagu melayu sunyi'), q('lagu rindu melayu'), q('lagu kesepian'), q('lagu patah hati'), q('lagu rindu'), q('balada melayu')],
    // Rock kapak is mostly power ballads, so it is not used for "angry" any more.
    angry: [q('metal melayu', 'rock'), q('malay metal', 'rock'), q('punk malaysia', 'rock'), q('lagu rock melayu', 'rock')],
    anxious: [q('lagu melayu tenang'), q('lagu santai melayu'), q('lagu tenang'), q('akustik malaysia', 'folk')],
    calm: [q('lagu santai melayu'), q('akustik melayu', 'folk'), q('malay acoustic', 'folk'), q('lagu santai')],
    nostalgic: [q('lagu melayu nostalgia'), q('lagu melayu 90an'), q('malay classics'), q('rock kapak', 'rock'), q('lagu evergreen melayu')],
    motivated: [q('lagu semangat melayu'), q('lagu motivasi melayu'), q('lagu semangat'), q('lagu patriotik'), q('malay hip hop', 'hip-hop')],
    empty: [q('lagu jiwang'), q('lagu melayu sedih'), q('lagu kecewa')],
    romantic: [q('lagu cinta melayu'), q('lagu jiwang romantik'), q('malay love songs'), q('lagu cinta'), q('lagu romantik')],
  },
  zh: {
    happy: [q('华语 快乐'), q('華語 快樂'), q('mandopop happy'), q('chinese happy songs'), q('c-pop hits')],
    sad: [q('华语 伤感'), q('華語 傷感'), q('mandopop sad'), q('chinese sad songs')],
    lonely: [q('华语 孤独'), q('華語 孤單'), q('mandopop ballads'), q('chinese lonely songs')],
    angry: [q('华语 重金属', 'rock'), q('chinese metal', 'rock'), q('chinese punk', 'rock'), q('华语 摇滚 发泄', 'rock')],
    anxious: [q('华语 治愈'), q('華語 療癒'), q('chinese healing songs'), q('mandopop chill')],
    calm: [q('华语 安静'), q('華語 放鬆'), q('mandopop chill'), q('chinese chill songs')],
    nostalgic: [q('华语 经典 老歌'), q('華語 經典'), q('mandopop classics'), q('chinese oldies')],
    motivated: [q('华语 励志'), q('華語 勵志'), q('mandopop workout'), q('chinese motivational songs')],
    empty: [q('华语 emo'), q('華語 失戀'), q('chinese indie', 'indie'), q('mandopop night')],
    romantic: [q('华语 情歌'), q('華語 情歌'), q('mandopop love songs'), q('chinese love songs')],
  },
  yue: {
    happy: [q('粤语 快乐'), q('廣東歌 開心'), q('cantopop happy'), q('cantopop hits')],
    sad: [q('粤语 伤感'), q('廣東歌 傷感'), q('cantopop sad'), q('cantonese sad songs'), q('傷心 廣東歌'), q('粵語 悲傷'), q('廣東歌')],
    lonely: [q('粤语 孤独'), q('廣東歌 孤獨'), q('cantopop ballads'), q('cantonese ballads')],
    angry: [q('hong kong metal', 'rock'), q('cantonese punk', 'rock'), q('粤语 摇滚 发泄', 'rock'), q('hong kong rock', 'rock')],
    anxious: [q('粤语 治愈'), q('廣東歌 治癒'), q('cantopop chill'), q('cantonese healing songs'), q('cantopop acoustic'), q('粵語 輕音樂')],
    calm: [q('粤语 安静'), q('廣東歌 放鬆'), q('cantopop chill'), q('cantonese chill')],
    nostalgic: [q('粤语 经典 老歌'), q('廣東歌 經典'), q('cantopop classics'), q('hong kong 80s')],
    motivated: [q('粤语 励志'), q('廣東歌 勵志'), q('cantopop workout'), q('cantopop upbeat'), q('廣東歌 正能量'), q('cantopop dance'), q('粵語 熱血')],
    empty: [q('粤语 失恋'), q('廣東歌 失戀'), q('cantopop night'), q('cantonese indie', 'indie')],
    romantic: [q('粤语 情歌'), q('廣東歌 情歌'), q('cantopop love songs'), q('cantonese love songs')],
  },
  nan: {
    happy: [q('台語 快樂'), q('台语歌'), q('hokkien happy'), q('taiwanese hokkien songs'), q('台語 流行'), q('閩南語歌')],
    sad: [q('台語 悲情'), q('台语 伤感'), q('hokkien sad'), q('taiwanese hokkien sad')],
    lonely: [q('台語 孤單'), q('台语 孤单'), q('hokkien lonely'), q('台語 抒情'), q('台語 失戀')],
    angry: [q('台語 搖滾', 'rock'), q('台语 摇滚', 'rock'), q('hokkien rock', 'rock'), q('台語 重金屬', 'rock')],
    anxious: [q('台語 療癒'), q('台语 治愈'), q('hokkien healing')],
    calm: [q('台語 放鬆'), q('台语 安静'), q('hokkien chill'), q('台語 民謠', 'folk')],
    nostalgic: [q('台語 經典 老歌'), q('台语 经典'), q('hokkien classics'), q('taiwanese oldies'), q('台語 老歌'), q('閩南語 經典')],
    motivated: [q('台語 勵志'), q('台语 励志'), q('hokkien motivation')],
    empty: [q('台語 心碎'), q('台语 失恋'), q('hokkien heartbreak'), q('台語 傷心')],
    romantic: [q('台語 情歌'), q('台语 情歌'), q('hokkien love songs'), q('閩南語 情歌')],
  },
  ko: {
    happy: [q('kpop happy'), q('신나는 노래')], sad: [q('korean sad ballad'), q('슬픈 발라드')],
    lonely: [q('korean lonely songs'), q('외로운 노래'), q('korean sad night'), q('새벽 감성 발라드'), q('이별 노래'), q('korean breakup songs'), q('k-ballad')],
    angry: [q('korean metal', 'rock'), q('korean punk', 'rock'), q('korean heavy rock', 'rock')],
    anxious: [q('korean healing songs'), q('힐링 노래')], calm: [q('korean chill'), q('잔잔한 노래')],
    nostalgic: [q('kpop 2000s'), q('추억의 노래')], motivated: [q('kpop workout'), q('운동 노래'), q('kpop hype')],
    empty: [q('korean indie', 'indie'), q('새벽 감성', 'indie')], romantic: [q('korean love songs'), q('사랑 노래')],
  },
  ja: {
    happy: [q('jpop happy'), q('元気が出る曲')], sad: [q('jpop sad'), q('泣ける曲')],
    lonely: [q('切ない 曲'), q('japanese lonely songs'), q('jpop lonely'), q('寂しい 曲'), q('失恋ソング'), q('japanese breakup songs'), q('jpop ballads')],
    angry: [q('japanese metal', 'rock'), q('japanese punk', 'rock'), q('jrock heavy', 'rock')],
    anxious: [q('癒し 曲'), q('japanese healing songs')], calm: [q('japanese chill'), q('落ち着く曲')],
    nostalgic: [q('jpop 2000s'), q('懐メロ')], motivated: [q('anime motivation'), q('やる気が出る曲')],
    empty: [q('japanese city pop'), q('夜 聴きたい曲', 'indie')], romantic: [q('jpop love songs'), q('ラブソング')],
  },
};

// Writing systems, to drop songs that are clearly in another language.
const HANGUL = /[가-힯ᄀ-ᇿ]/;
const KANA = /[぀-ヿ]/;
const HAN = /[一-鿿㐀-䶿]/;

export function fitsLanguage(language, text) {
  if (language === 'ko') return !KANA.test(text) && !(HAN.test(text) && !HANGUL.test(text));
  if (language === 'ja') return !HANGUL.test(text);
  if (['zh', 'yue', 'nan'].includes(language)) return !HANGUL.test(text) && !KANA.test(text);
  return !HANGUL.test(text) && !KANA.test(text) && !HAN.test(text); // en, ms
}

const popularityOf = (rank) => Math.round(Math.min(100, (Math.log10(Number(rank) + 1) / 6) * 100));

export function mapCatalogTrack(track, { language, mood, genre }) {
  const derived = deriveFromMoods([mood]);
  return {
    id: `deezer-${String(track.id).replace(/[^0-9]/g, '')}`,
    title: String(track.title || track.title_short || 'Untitled').trim().slice(0, 200),
    artist: String(track.artist?.name || 'Unknown artist').trim().slice(0, 200),
    genres: [genre],
    moods: [mood],
    ...derived,
    popularity: popularityOf(track.rank ?? 0),
    year: null,
    provider: 'deezer',
    external_url: track.link || null,
    preview_url: null, // Deezer preview links expire; MOODIFY asks Deezer for a fresh one when playing
    artwork_url: track.album?.cover_medium || track.album?.cover || null,
    album: track.album?.title || null,
    duration_s: Number(track.duration) || null,
    license_url: null,
    language,
    mood_source: 'playlist',
  };
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function deezer(path) {
  await pause(env.deezer.requestGapMs); // stays well under Deezer's 50 requests per 5 seconds
  const data = await fetchJson(`${env.deezer.apiBase}${path}`, 'Deezer');
  if (data.error) {
    if (data.error.code === 4) {
      await pause(5000);
      return deezer(path);
    }
    throw new HttpError(502, `Deezer: ${data.error.message ?? 'request failed'}`);
  }
  return data;
}

const PLAYLISTS_PER_SEARCH = 10; // Deezer sorts by relevance; further results are rarely on topic
const MAX_TRACKS_PER_PLAYLIST = 2000;

// Every track of a playlist, page by page.
async function playlistTracks(id) {
  const tracks = [];
  for (let index = 0; index < MAX_TRACKS_PER_PLAYLIST; index += 100) {
    const page = await deezer(`/playlist/${id}/tracks?limit=100&index=${index}`);
    tracks.push(...(page.data ?? []));
    if (!page.next || (page.data ?? []).length === 0) break;
  }
  return tracks;
}

// Songs for one language and mood: every search, every relevant playlist,
// every song (no limit unless "perMood" is given). "tried" records each search
// and how many playlists and songs it gave, so empty results can be explained.
async function tracksFor(language, mood, perMood) {
  const found = new Map();
  const tried = [];
  const seenPlaylists = new Set();
  for (const query of CATALOG_QUERIES[language][mood]) {
    if (found.size >= perMood) break;
    const playlists = (await deezer(`/search/playlist?${new URLSearchParams({ q: query.text, limit: '25' })}`)).data ?? [];
    const usable = playlists.filter((item) => (item.nb_tracks ?? 0) >= 8 && !seenPlaylists.has(item.id)).slice(0, PLAYLISTS_PER_SEARCH);
    let kept = 0;
    for (const playlist of usable) {
      if (found.size >= perMood) break;
      seenPlaylists.add(playlist.id);
      for (const track of await playlistTracks(playlist.id)) {
        if (found.size >= perMood) break;
        if (!track?.id || track.readable === false || found.has(track.id)) continue;
        if (!fitsLanguage(language, `${track.title} ${track.artist?.name ?? ''}`)) continue;
        found.set(track.id, mapCatalogTrack(track, { language, mood, genre: query.genre }));
        kept += 1;
      }
    }
    tried.push({ query: query.text, playlists: usable.length, kept });
  }
  return { songs: [...found.values()], tried };
}

export async function importDeezerCatalog({ perMood = Infinity, languages = Object.keys(CATALOG_QUERIES), onProgress = () => {} } = {}) {
  const byId = new Map();
  const failures = [];
  for (const language of languages) {
    for (const mood of Object.keys(CATALOG_QUERIES[language])) {
      try {
        const { songs, tried } = await tracksFor(language, mood, perMood);
        for (const song of songs) {
          const existing = byId.get(song.id);
          if (existing) existing.moods = [...new Set([...existing.moods, mood])].slice(0, 3);
          else byId.set(song.id, song);
        }
        onProgress({ language, mood, found: songs.length, tried });
      } catch (error) {
        failures.push({ language, mood, error: error.message });
        onProgress({ language, mood, found: 0, error: error.message });
      }
    }
  }
  return { songs: [...byId.values()], failures };
}
