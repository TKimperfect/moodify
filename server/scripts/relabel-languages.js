// Gives every imported song the language it is really sung in, using the
// songs already imported and each song's ISRC (the international code of a
// recording, which tells the country of its label). ISRCs that are not known
// yet are looked up on Deezer first and saved in server/data/isrc-cache.json.
// Run from the "moodify" folder:  npm run music:relabel-languages
import { LANGUAGES } from '../src/data/taxonomy.js';
import { describeChanges } from '../src/services/music/language.js';
import { readCatalog, relabel, updateIsrcs } from './languageLabels.js';
import { saveCatalog } from './catalogStore.js';

const NAMES = { ...LANGUAGES, instrumental: 'Instrumental', other: 'Other languages', unknown: 'Unknown language' };
const deezer = await readCatalog('deezer-catalog');
const muse = await readCatalog('muse-catalog');
if (deezer.length + muse.length === 0) {
  console.error('✗ No imported songs found in server/data. Run the imports first.');
  process.exit(1);
}

let stopRequested = false;
process.on('SIGINT', () => {
  if (stopRequested) process.exit(1);
  stopRequested = true;
  console.log('\n  Stopping and saving the codes found so far… (run the same command again to continue)');
});

console.log(`Checking the language of ${deezer.length + muse.length} songs…`);
const isrcs = await updateIsrcs({ deezer, muse }, { shouldStop: () => stopRequested });
if (stopRequested) {
  console.log('Stopped before the labels were changed. Run "npm run music:relabel-languages" again to continue.');
  process.exit(0);
}

const result = relabel({ deezer, muse, isrcs });
if (result.dropped.length) console.log(`\n${result.dropped.length} songs found only in Taiwanese Hokkien playlists leave the catalogue (Hokkien is no longer offered).`);
const lines = describeChanges(result.changes, { ...NAMES, yue: 'Cantonese (old label)', nan: 'Taiwanese Hokkien (old label)' });
console.log(result.changes.length ? `\n${result.changes.length} songs get a different language:` : '\nAll languages were already right.');
for (const line of lines.slice(0, 20)) console.log(`  ${line}`);
if (lines.length > 20) console.log(`  …and ${lines.length - 20} smaller groups`);

const all = [...result.deezer, ...result.muse];
const counts = Object.entries(NAMES)
  .map(([id, name]) => [name, all.filter((song) => song.language === id).length])
  .filter(([, count]) => count);
console.log(`\nNow: ${counts.map(([name, count]) => `${name} ${count}`).join(' · ')}\n`);

if (result.changes.length || result.dropped.length) {
  if (result.deezer.length) await saveCatalog('deezer-catalog', 'deezer', result.deezer);
  if (result.muse.length) await saveCatalog('muse-catalog', 'muse', result.muse);
  if (result.dropped.length) console.log('Then run "npm run music:prune-languages -- delete" to remove them from Supabase too (songs anyone saved or played are kept).');
  console.log('Restart the backend (Render: Manual Deploy → Restart) to see the new labels on the website.');
}
process.exit(0);
