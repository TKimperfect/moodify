// Imports real songs from Deezer playlists in six languages (Malay, Mandarin,
// Cantonese, Korean, Japanese, English). Each song gets the language it is
// really sung in (playlists mix languages), e.g. Indonesian songs from Malay playlists.
// Run from the "moodify" folder with:  npm run music:import-languages
// By default it takes every song from the matching playlists (up to 10
// playlists per search). Optional: a maximum per language and mood, e.g.
//   npm run music:import-languages -- 50
// It can take 30 minutes or more.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDeezerCatalog } from '../src/services/music/deezerCatalog.js';
import { saveCatalog } from './catalogStore.js';
import { LANGUAGES } from '../src/data/taxonomy.js';
import { describeChanges } from '../src/services/music/language.js';
import { relabel, updateIsrcs } from './languageLabels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const perMood = Number(process.argv[2]) || Infinity;

// Songs that also came from MuSe keep MuSe's mood scores (the research data
// is better than a playlist name), so they are not written again here. MuSe's
// artists also help to recognise Western songs inside Korean or Chinese playlists.
let museSongs = [];
try {
  museSongs = JSON.parse(await readFile(path.join(here, '..', 'data', 'muse-catalog.json'), 'utf8')).songs;
} catch {
  // no MuSe import yet
}
const research = new Set(museSongs.map((song) => song.id));

console.log(`Asking Deezer for ${Number.isFinite(perMood) ? `up to ${perMood}` : 'all'} songs per language and mood (this can take 30 minutes or more)…`);
let current = null;
const { songs, failures, changes } = await importDeezerCatalog({
  perMood,
  westernArtists: museSongs.map((song) => song.artist),
  onProgress: ({ language, mood, found, error, tried = [] }) => {
    if (current !== language) {
      current = language;
      console.log(`\n${LANGUAGES[language]}`);
    }
    console.log(error ? `  ✗ ${mood}: ${error}` : `  ${found > 0 ? '✓' : '·'} ${mood}: ${found} songs`);
    // Explain empty results: which searches were tried and what they found.
    if (!error && found === 0) {
      for (const attempt of tried) console.log(`      "${attempt.query}": ${attempt.playlists} playlists, ${attempt.kept} songs kept`);
    }
  },
});

if (songs.length === 0) {
  console.error('\n✗ Deezer returned no songs. Nothing was saved.');
  process.exit(1);
}

const NAMES = { ...LANGUAGES, instrumental: 'Instrumental', other: 'Other languages' };
if (changes.length) {
  console.log(`\n${changes.length} songs are sung in another language than their playlist:`);
  for (const line of describeChanges(changes, NAMES).slice(0, 12)) console.log(`  ${line}`);
}

// Together with MuSe, so both use what the other knows about each artist,
// and with each song's ISRC (the country of its label).
const isrcs = await updateIsrcs({ deezer: songs, muse: museSongs });
const together = relabel({ deezer: songs, muse: museSongs, isrcs });
const fresh = together.deezer;
if (fresh.length < songs.length) console.log(`\n  ${songs.length - fresh.length} songs are already in MOODIFY from MuSe and keep their MuSe moods.`);

const counts = Object.fromEntries(Object.keys(NAMES).map((id) => [id, fresh.filter((song) => song.language === id).length]));
console.log('\n  ' + Object.entries(counts).filter(([, count]) => count).map(([id, count]) => `${NAMES[id]} ${count}`).join(' · '));
if (failures.length) console.log(`  (${failures.length} searches failed; run again later to fill the gaps)`);
await saveCatalog('deezer-catalog', 'deezer', fresh);
const museChanged = together.changes.filter((change) => research.has(change.id));
if (museChanged.length) await saveCatalog('muse-catalog', 'muse', together.muse);
console.log('Restart "npm run dev" to use the new songs. Then run "npm run music:prune-languages" to remove songs from older imports.');
