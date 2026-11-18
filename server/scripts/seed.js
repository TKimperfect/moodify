// Copies the built-in sample songs into your Supabase database.
// Run from the "moodify" folder with:  npm run db:seed
// Safe to run again: existing songs are updated, not duplicated.
import { createAdminClient, hasSecretKey } from '../src/lib/supabase.js';
import { SONGS } from '../src/data/songs.js';

if (!hasSecretKey) {
  console.error('✗ SUPABASE_URL and SUPABASE_SECRET_KEY must be filled in inside server/.env');
  process.exit(1);
}

const db = createAdminClient();
const rows = SONGS.map((song) => ({ ...song, provider: 'sample' }));

const { error } = await db.from('songs').upsert(rows, { onConflict: 'id' });
if (error) {
  console.error(`✗ Could not write songs: ${error.message}`);
  if (/does not exist|schema cache|permission denied/i.test(error.message)) {
    console.error('  Did you run supabase/schema.sql in the Supabase SQL Editor first?');
  }
  process.exit(1);
}

const { count, error: countError } = await db.from('songs').select('id', { count: 'exact', head: true });
if (countError) {
  console.error(`✗ Songs were written but could not be counted: ${countError.message}`);
  process.exit(1);
}
console.log(`✓ ${rows.length} songs written. The songs table now holds ${count} songs.`);
