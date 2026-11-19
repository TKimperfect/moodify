// Removes songs left over from older Deezer playlist imports.
// Run from the "moodify" folder:
//   npm run music:prune-languages            (only shows what would be removed)
//   npm run music:prune-languages -- delete (really removes them)
// Songs in anyone's favourites, playlists or history are never removed.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminClient, hasSecretKey } from '../src/lib/supabase.js';
import { staleSongIds } from '../src/services/music/prune.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'data', 'deezer-catalog.json');
// "delete" also works: npm swallows "--delete" when run from the moodify folder.
const really = process.argv.slice(2).some((arg) => arg.replace(/^-+/, '') === 'delete');

if (!hasSecretKey) {
  console.error('✗ Supabase is not set up in server/.env, so there is nothing to clean.');
  process.exit(1);
}
let current;
try {
  current = JSON.parse(await readFile(FILE, 'utf8')).songs.map((song) => song.id);
} catch {
  console.error('✗ server/data/deezer-catalog.json is missing. Run "npm run music:import-languages" first.');
  process.exit(1);
}

// Songs that came from MuSe are kept too.
try {
  const muse = JSON.parse(await readFile(path.join(here, '..', 'data', 'muse-catalog.json'), 'utf8')).songs;
  current.push(...muse.map((song) => song.id));
} catch {
  // no MuSe import
}

const db = createAdminClient();
async function readAll(table, columns, filter = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).order(columns.split(',')[0]).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

try {
  const songs = await readAll('songs', 'id,provider,mood_source,language,moods', (query) => query.eq('provider', 'deezer').eq('mood_source', 'playlist'));
  const used = [
    ...(await readAll('favorites', 'song_id')),
    ...(await readAll('playlist_songs', 'song_id')),
    ...(await readAll('listening_history', 'song_id')),
  ].map((row) => row.song_id);
  const stale = new Set(staleSongIds(songs, current, used));

  const counts = {};
  for (const song of songs) {
    if (!stale.has(song.id)) continue;
    const key = `${song.language ?? '?'} ${song.moods?.[0] ?? '?'}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  console.log(`${stale.size} old Deezer songs are no longer in the latest import (songs people used are kept).`);
  for (const [key, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${key}: ${count}`);

  if (!really) {
    if (stale.size) console.log('\nNothing was removed. To remove them, run:  npm run music:prune-languages -- delete');
    process.exit(0);
  }
  const ids = [...stale];
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from('songs').delete().in('id', ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  console.log(`✓ Removed ${ids.length} songs. The website picks up the change within 6 hours, or at once after a restart (Render: Manual Deploy → Restart).`);
} catch (error) {
  console.error(`✗ Could not clean up: ${error.message}`);
  process.exit(1);
}
