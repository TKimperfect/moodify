// Imports songs with listener-based mood scores from the MuSe dataset and
// finds each one on Deezer so it can be played. By default every song with a
// mood is checked (best documented first). That can take a few hours, so:
//   - Press Ctrl + C at any time: the songs found so far are saved.
//   - Run the command again later: it continues where it stopped.
// Run from the "moodify" folder with:  npm run music:import-muse
// Options: a number to stop after that many songs per mood, and/or the path of
// a MuSe CSV you downloaded yourself (e.g. muse_v3.csv from Kaggle):
//   npm run music:import-muse -- C:\Users\you\Downloads\muse_v3.csv
//   npm run music:import-muse -- 100
// To start over from scratch, delete server/data/muse-progress-v2.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importMuse } from '../src/services/music/datasetImport.js';
import { saveCatalog, moodCounts } from './catalogStore.js';
import { readCatalog, relabel } from './languageLabels.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// v2: progress saved by version 1.2.2 is ignored (its lookups were faulty).
const PROGRESS_FILE = path.join(here, '..', 'data', 'muse-progress-v2.json');

const args = process.argv.slice(2);
const perMood = Number(args.find((arg) => /^\d+$/.test(arg))) || Infinity;
const localFile = args.find((arg) => !/^\d+$/.test(arg))?.replace(/^"|"$/g, '');

async function loadProgress() {
  try {
    return new Map(Object.entries(JSON.parse(await readFile(PROGRESS_FILE, 'utf8'))));
  } catch {
    return new Map();
  }
}
async function saveProgress(progress) {
  await mkdir(path.dirname(PROGRESS_FILE), { recursive: true });
  await writeFile(PROGRESS_FILE, JSON.stringify(Object.fromEntries(progress)));
}

let stopRequested = false;
process.on('SIGINT', () => {
  if (stopRequested) process.exit(1); // a second Ctrl + C stops immediately
  stopRequested = true;
  console.log('\n  Stopping after the current song and saving what was found… (Ctrl + C again to quit without saving)');
});

console.log('MuSe: The Musical Sentiment Dataset (Akiki & Burghardt, 2021, CC BY 4.0)');
try {
  const progress = await loadProgress();
  const csvText = localFile ? await readFile(localFile, 'utf8') : undefined;
  console.log(localFile ? `  reading ${localFile}` : '  downloading from Zenodo (about 15 MB)…');
  const started = Date.now();
  const songs = await importMuse({
    perMood,
    csvText,
    progress,
    shouldStop: () => stopRequested,
    onCheckpoint: saveProgress,
    onProgress: (event) => {
      if (event.step === 'read') console.log(`  ✓ ${event.count} songs with mood scores (first: ${event.sample.join(' · ')})`);
      const why = (stats) =>
        `      found ${stats.found} · not on Deezer ${stats['no-results']} · names did not match ${stats.mismatch} · errors ${stats.error}` +
        Object.entries(stats.examples).map(([reason, example]) => `\n        e.g. ${reason}: ${example}`).join('');
      if (event.step === 'first') console.log(`  First 20 lookups:\n${why(event.stats)}`);
      if (event.step === 'stopped') {
        console.log(`  ✗ Deezer is refusing requests: ${event.reason}`);
        console.log('    Stopping. Wait 15 minutes, then run the same command again to continue.');
      }
      if (event.step === 'start') {
        const left = event.total - event.already;
        console.log(`  ${event.total} songs to look up on Deezer${event.already ? `, ${event.already} done in an earlier run` : ''}.`);
        console.log(`  About ${Math.ceil((left * 0.2) / 60)} minutes left. Ctrl + C saves and stops; run again to continue.`);
      }
      if (event.step === 'matching') {
        const minutes = ((Date.now() - started) / 60000).toFixed(1);
        console.log(`    ${event.checked}/${event.total} checked, ${event.kept} found on Deezer (${minutes} min)`);
        if (event.kept === 0 && event.checked >= 100) console.log(why(event.stats));
      }
    },
  });
  await saveProgress(progress);
  if (songs.length === 0) throw new Error('No songs were found on Deezer yet (see the reasons above)');
  console.log(`  moods: ${moodCounts(songs)}`);
  // Languages, using what the language playlists know about each artist.
  const { muse } = relabel({ deezer: await readCatalog('deezer-catalog'), muse: songs });
  await saveCatalog('muse-catalog', 'muse', muse);
  console.log(stopRequested ? 'Stopped early. Run the same command again to continue.' : 'All MuSe songs checked.');
  console.log('Restart "npm run dev" to use the new songs.');
  process.exit(0);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
