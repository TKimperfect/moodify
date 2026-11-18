// Imports Creative Commons songs from Jamendo into MOODIFY's catalogue.
// Run from the "moodify" folder with:  npm run music:import
//
// What it does:
//  1. Asks Jamendo for popular songs for each of the ten moods.
//  2. Works out moods, energy, tempo and genres for each song.
//  3. Saves them to server/data/jamendo-catalog.json (used when there is no database).
//  4. If Supabase is set up, also writes them into the songs table.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isJamendoConfigured } from '../src/services/music/providers/jamendo.provider.js';
import { importJamendo } from '../src/services/music/jamendoImport.js';
import { createAdminClient, hasSecretKey } from '../src/lib/supabase.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(here, '..', 'data', 'jamendo-catalog.json');

if (!isJamendoConfigured()) {
  console.error('✗ JAMENDO_CLIENT_ID is empty in server/.env. See the README section "Real music: Jamendo".');
  process.exit(1);
}

const perMood = Number(process.argv[2]) || 30;
console.log(`Asking Jamendo for up to ${perMood} songs per mood…`);

let result;
try {
  result = await importJamendo({
    perMood,
    onProgress: ({ mood, found, error }) => console.log(error ? `  ✗ ${mood}: ${error}` : `  ✓ ${mood}: ${found} songs`),
  });
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

const { songs } = result;
if (songs.length === 0) {
  console.error('✗ Jamendo returned no songs. Nothing was saved.');
  process.exit(1);
}

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify({ imported_at: new Date().toISOString(), source: 'jamendo', songs }, null, 2)}\n`);
console.log(`✓ ${songs.length} songs saved to server/data/jamendo-catalog.json`);

if (hasSecretKey) {
  const db = createAdminClient();
  const { error } = await db.from('songs').upsert(songs, { onConflict: 'id' });
  if (error) {
    console.error(`✗ Could not write to Supabase: ${error.message}`);
    if (/column/i.test(error.message)) {
      console.error('  Run supabase/migrations/002_music_sources.sql in the Supabase SQL Editor first, then try again.');
    }
    process.exit(1);
  }
  console.log(`✓ ${songs.length} songs written to the Supabase songs table`);
} else {
  console.log('  (Supabase is not set up, so only the local file was written.)');
}
console.log('Restart "npm run dev" to use the new songs.');
