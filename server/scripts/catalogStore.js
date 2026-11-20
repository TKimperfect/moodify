// Saves imported songs to server/data/<name>.json and, when Supabase is set
// up, to the songs table (in chunks, so large imports work too).
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminClient, hasSecretKey } from '../src/lib/supabase.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// "npm run music:relabel-languages -- all" writes every song to Supabase again,
// not only the songs that changed since the last save.
const writeAll = process.argv.slice(2).some((arg) => arg.replace(/^-+/, '') === 'all');

// What a song looks like in the songs table ("found_in" stays in the file only).
const rowOf = ({ found_in: _foundIn, ...song }) => song;
const sameRow = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function saveCatalog(name, source, allSongs) {
  // Different dataset rows can lead to the same Deezer song. Keep one copy of
  // each id (the last one), because Supabase refuses the same id twice in one write.
  const songs = [...new Map(allSongs.map((song) => [song.id, song])).values()];
  const file = path.join(here, '..', 'data', `${name}.json`);
  // The songs as last saved: those that did not change need no new write.
  // (Rewriting all 100,000 rows each time leaves old copies behind in the
  // database, which slows reading the songs down.)
  let before = new Map();
  try {
    before = new Map(JSON.parse(await readFile(file, 'utf8')).songs.map((song) => [song.id, rowOf(song)]));
  } catch {
    // first save: everything is new
  }
  // The file is written after Supabase, so a failed write is tried again
  // on the next run (the file is what tells which songs changed).
  const saveFile = async () => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify({ imported_at: new Date().toISOString(), source, songs }, null, 2)}\n`);
    console.log(`✓ ${songs.length} songs saved to server/data/${name}.json`);
  };

  if (!hasSecretKey) {
    await saveFile();
    console.log('  (Supabase is not set up, so only the local file was written.)');
    return;
  }
  const db = createAdminClient();
  // "found_in" (where a song was found) is kept in the local file only.
  // Songs of unknown language stay in the local file (what they say about
  // their artists still helps to label other songs) but are not offered.
  const offered = songs.filter((song) => song.language !== 'unknown').map(rowOf);
  const rows = writeAll ? offered : offered.filter((row) => !before.has(row.id) || !sameRow(before.get(row.id), row));
  if (rows.length === 0) {
    await saveFile();
    console.log(`✓ Supabase already has these ${offered.length} songs as they are now (to write them all again: add "-- all")`);
    return;
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('songs').upsert(rows.slice(i, i + 500), { onConflict: 'id' });
    if (error) {
      console.error(`✗ Could not write to Supabase: ${error.message}`);
      if (/column|schema cache/i.test(error.message)) console.error('  Run supabase/migrations/003_languages_youtube.sql in the Supabase SQL Editor first.');
      process.exit(1);
    }
  }
  await saveFile();
  const unchanged = offered.length - rows.length;
  console.log(
    `✓ ${rows.length} songs written to the Supabase songs table` +
      (unchanged ? ` (${unchanged} unchanged songs were already there)` : '') +
      (songs.length > offered.length ? ` (${songs.length - offered.length} of unknown language left out)` : ''),
  );
}

export function moodCounts(songs) {
  const counts = {};
  for (const song of songs) counts[song.moods[0]] = (counts[song.moods[0]] ?? 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => `${mood} ${count}`)
    .join(' · ');
}
