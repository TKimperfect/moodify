// Imports real songs in seven languages (Malay, Mandarin, Cantonese,
// Taiwanese Hokkien, Korean, Japanese, English) from Deezer playlists.
// Run from the "moodify" folder with:  npm run music:import-languages
// By default it takes every song from the matching playlists (up to 10
// playlists per search). Optional: a maximum per language and mood, e.g.
//   npm run music:import-languages -- 50
// It can take 30 minutes or more.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDeezerCatalog } from '../src/services/music/deezerCatalog.js';
import { createAdminClient, hasSecretKey } from '../src/lib/supabase.js';
import { LANGUAGES } from '../src/data/taxonomy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(here, '..', 'data', 'deezer-catalog.json');
const perMood = Number(process.argv[2]) || Infinity;

console.log(`Asking Deezer for ${Number.isFinite(perMood) ? `up to ${perMood}` : 'all'} songs per language and mood (this can take 30 minutes or more)…`);
let current = null;
const { songs, failures } = await importDeezerCatalog({
  perMood,
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

const counts = Object.fromEntries(Object.keys(LANGUAGES).map((id) => [id, songs.filter((song) => song.language === id).length]));
await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ imported_at: new Date().toISOString(), source: 'deezer', songs }, null, 2)}\n`);
console.log(`\n✓ ${songs.length} songs saved to server/data/deezer-catalog.json`);
console.log('  ' + Object.entries(counts).map(([id, count]) => `${LANGUAGES[id]} ${count}`).join(' · '));
if (failures.length) console.log(`  (${failures.length} searches failed; run again later to fill the gaps)`);

if (hasSecretKey) {
  const { error } = await createAdminClient().from('songs').upsert(songs, { onConflict: 'id' });
  if (error) {
    console.error(`✗ Could not write to Supabase: ${error.message}`);
    if (/column|schema cache/i.test(error.message)) console.error('  Run supabase/migrations/003_languages_youtube.sql in the Supabase SQL Editor first.');
    process.exit(1);
  }
  console.log(`✓ ${songs.length} songs written to the Supabase songs table`);
}
console.log('Restart "npm run dev" to use the new songs.');
