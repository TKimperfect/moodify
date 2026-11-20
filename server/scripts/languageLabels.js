// Language labels for all imported songs together, so what one import knows
// about an artist (e.g. their Korean titles or Malaysian label) helps the others.
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelLanguages, artistKey } from '../src/services/music/language.js';
import { fetchIsrcs } from '../src/services/music/isrc.js';

// Languages heard in the 30-second previews of songs whose title, artist and
// ISRC say nothing (checked with a speech recogniser, then by hand).
const HEARD = new Map(Object.entries(JSON.parse(readFileSync(fileURLToPath(new URL('../src/data/heard-languages.json', import.meta.url)), 'utf8')).songs));

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFile = (name) => path.join(here, '..', 'data', name);
const ISRC_FILE = dataFile('isrc-cache.json');

export async function readCatalog(name) {
  try {
    return JSON.parse(await readFile(dataFile(`${name}.json`), 'utf8')).songs ?? [];
  } catch {
    return [];
  }
}

// Song id -> ISRC (or null when Deezer has none), saved in server/data/isrc-cache.json.
export async function readIsrcs() {
  try {
    return new Map(Object.entries(JSON.parse(await readFile(ISRC_FILE, 'utf8'))));
  } catch {
    return new Map();
  }
}
export async function saveIsrcs(known) {
  await mkdir(path.dirname(ISRC_FILE), { recursive: true });
  await writeFile(`${ISRC_FILE}.tmp`, JSON.stringify(Object.fromEntries(known)));
  await rename(`${ISRC_FILE}.tmp`, ISRC_FILE);
}

// The songs whose ISRC helps: every language-playlist song, and one song per
// MuSe artist (enough to know where the artist's label is).
export function songsNeedingIsrc({ deezer = [], muse = [] }) {
  const ids = deezer.map((song) => song.id);
  const artists = new Set();
  for (const song of muse) {
    const key = artistKey(song.artist);
    if (artists.has(key)) continue;
    artists.add(key);
    ids.push(song.id);
  }
  return ids.filter((id) => String(id).startsWith('deezer-'));
}

// Looks up the ISRCs still missing (saved as it goes; safe to stop and run again).
export async function updateIsrcs(catalogs, { shouldStop, log = console.log } = {}) {
  const known = await readIsrcs();
  const ids = songsNeedingIsrc(catalogs);
  const missing = ids.filter((id) => !known.has(id)).length;
  if (missing === 0) return known;
  log(`  Looking up ${missing} song codes (ISRC) on Deezer, about ${Math.ceil(missing / 6 / 60)} minutes. Ctrl + C saves and stops; run again to continue.`);
  const result = await fetchIsrcs(ids, {
    known,
    shouldStop,
    onCheckpoint: saveIsrcs,
    onProgress: ({ done, total }) => log(`    ${done}/${total} checked`),
  });
  if (result.failed) log(`  (${result.failed} could not be checked now; run again later for them)`);
  return result.known;
}

// deezer: songs from language playlists (language = playlist language when
// "found_in" is missing, as in files from before version 1.2.12).
// muse: songs from the MuSe dataset.
export function relabel({ deezer = [], muse = [], isrcs = new Map(), heard = HEARD }) {
  const museIds = new Set(muse.map((song) => song.id));
  const foundIn = (song) => song.found_in ?? (song.language ? [song.language] : []);
  // Songs found only in Taiwanese Hokkien playlists (no longer offered, and
  // Hokkien cannot be told from Mandarin by the title) leave the catalogue.
  const hokkienOnly = (song) => !museIds.has(song.id) && foundIn(song).length > 0 && foundIn(song).every((language) => language === 'nan');
  const dropped = deezer.filter(hokkienOnly);
  deezer = deezer.filter((song) => !hokkienOnly(song));
  const playlistsById = new Map(deezer.map((song) => [song.id, foundIn(song)]));
  const input = [
    ...deezer.filter((song) => !museIds.has(song.id)).map((song) => ({ ...song, found_in: foundIn(song) })),
    // MuSe songs that were also in a language playlist get that as a hint.
    ...muse.map((song) => ({ ...song, found_in: song.found_in ?? playlistsById.get(song.id) ?? [] })),
  ];
  const { songs, changes } = labelLanguages(input, { isrcs, museIds, heard });
  return {
    deezer: songs.filter((song) => !museIds.has(song.id)),
    muse: songs.filter((song) => museIds.has(song.id)),
    changes,
    dropped,
  };
}
