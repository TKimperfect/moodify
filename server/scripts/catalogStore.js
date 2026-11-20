// Saves imported songs to server/data/<name>.json and, when Supabase is set
// up, to the songs table (in chunks, so large imports work too).
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminClient, hasSecretKey } from '../src/lib/supabase.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function saveCatalog(name, source, allSongs) {
  // Different dataset rows can lead to the same Deezer song. Keep one copy of
  // each id (the last one), because Supabase refuses the same id twice in one write.
  const songs = [...new Map(allSongs.map((song) => [song.id, song])).values()];
  const file = path.join(here, '..', 'data', `${name}.json`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify({ imported_at: new Date().toISOString(), source, songs }, null, 2)}\n`);
  console.log(`✓ ${songs.length} songs saved to server/data/${name}.json`);

  if (!hasSecretKey) {
    console.log('  (Supabase is not set up, so only the local file was written.)');
    return;
  }
  const db = createAdminClient();
  // "found_in" (where a song was found) is kept in the local file only.
  // Songs of unknown language stay in the local file (what they say about
  // their artists still helps to label other songs) but are not offered.
  const rows = songs.filter((song) => song.language !== 'unknown').map(({ found_in: _foundIn, ...song }) => song);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('songs').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
    if (error) {
      console.error(`✗ Could not write to Supabase: ${error.message}`);
      if (/column|schema cache/i.test(error.message)) console.error('  Run supabase/migrations/003_languages_youtube.sql in the Supabase SQL Editor first.');
      process.exit(1);
    }
  }
  console.log(`✓ ${rows.length} songs written to the Supabase songs table${rows.length < songs.length ? ` (${songs.length - rows.length} of unknown language left out)` : ''}`);
}

export function moodCounts(songs) {
  const counts = {};
  for (const song of songs) counts[song.moods[0]] = (counts[song.moods[0]] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => `${mood} ${count}`)
    .join(' · ');
}
