// Gives every imported song the language it is really sung in, using the
// songs already imported (no new Deezer searches; a few minutes).
// Run from the "moodify" folder:  npm run music:relabel-languages
import { LANGUAGES } from '../src/data/taxonomy.js';
import { describeChanges } from '../src/services/music/language.js';
import { readCatalog, relabel } from './languageLabels.js';
import { saveCatalog } from './catalogStore.js';

const NAMES = { ...LANGUAGES, other: 'Other languages' };
const deezer = await readCatalog('deezer-catalog');
const muse = await readCatalog('muse-catalog');
if (deezer.length + muse.length === 0) {
  console.error('✗ No imported songs found in server/data. Run the imports first.');
  process.exit(1);
}

console.log(`Checking the language of ${deezer.length + muse.length} songs…`);
const result = relabel({ deezer, muse });
const lines = describeChanges(result.changes, NAMES);
console.log(result.changes.length ? `\n${result.changes.length} songs get a different language:` : '\nAll languages were already right.');
for (const line of lines.slice(0, 15)) console.log(`  ${line}`);
if (lines.length > 15) console.log(`  …and ${lines.length - 15} smaller groups`);

const all = [...result.deezer, ...result.muse];
const counts = Object.entries(NAMES)
  .map(([id, name]) => [name, all.filter((song) => song.language === id).length])
  .filter(([, count]) => count);
console.log(`\nNow: ${counts.map(([name, count]) => `${name} ${count}`).join(' · ')}\n`);

if (result.changes.length) {
  if (result.deezer.length) await saveCatalog('deezer-catalog', 'deezer', result.deezer);
  if (result.muse.length) await saveCatalog('muse-catalog', 'muse', result.muse);
  console.log('Restart the backend (Render: Manual Deploy → Restart) to see the new labels on the website.');
}
