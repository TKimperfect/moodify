// Language labels for all imported songs together, so what one import knows
// about an artist (e.g. their Korean titles) helps the others.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelLanguages } from '../src/services/music/language.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function readCatalog(name) {
  try {
    return JSON.parse(await readFile(path.join(here, '..', 'data', `${name}.json`), 'utf8')).songs ?? [];
  } catch {
    return [];
  }
}

// deezer: songs from language playlists (language = playlist language when
// "found_in" is missing, as in files from before version 1.2.12).
// muse: songs from the MuSe dataset.
export function relabel({ deezer = [], muse = [] }) {
  const museIds = new Set(muse.map((song) => song.id));
  const foundIn = (song) => song.found_in ?? (song.language ? [song.language] : []);
  const playlistsById = new Map(deezer.map((song) => [song.id, foundIn(song)]));
  const input = [
    ...deezer.filter((song) => !museIds.has(song.id)).map((song) => ({ ...song, found_in: foundIn(song) })),
    // MuSe songs that were also in a language playlist get that as a hint.
    ...muse.map((song) => ({ ...song, found_in: song.found_in ?? playlistsById.get(song.id) ?? [] })),
  ];
  const { songs, changes } = labelLanguages(input, { extraWesternArtists: muse.map((song) => song.artist) });
  return {
    deezer: songs.filter((song) => !museIds.has(song.id)),
    muse: songs.filter((song) => museIds.has(song.id)),
    changes,
  };
}
