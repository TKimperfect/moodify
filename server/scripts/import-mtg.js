// Imports Jamendo songs with human mood tags from the MTG-Jamendo dataset.
// Run from the "moodify" folder with:  npm run music:import-mtg
// By default every tagged song is imported. Optional: a maximum per mood,
// e.g.  npm run music:import-mtg -- 100
// Needs JAMENDO_CLIENT_ID in server/.env.
import { importMtgJamendo } from '../src/services/music/datasetImport.js';
import { saveCatalog, moodCounts } from './catalogStore.js';

const perMood = Number(process.argv[2]) || Infinity;
console.log('MTG-Jamendo dataset (Bogdanov et al., 2019, CC BY-NC-SA 4.0)');
try {
  const songs = await importMtgJamendo({
    perMood,
    onProgress: (event) => {
      if (event.step === 'read') console.log(`  ✓ downloaded: ${event.count} tagged songs`);
      if (event.step === 'picked') {
        console.log(`  ✓ ${event.count} songs have a mood${Number.isFinite(perMood) ? ` (up to ${perMood} per mood)` : ''}; asking Jamendo for details…`);
        console.log(`    about ${Math.ceil(event.count / 40 / 2 / 60) || 1}–${Math.ceil(event.count / 40 / 60) + 1} minutes`);
      }
      if (event.step === 'retry') console.log(`    Jamendo refused a batch of ${event.size} (${event.reason}); trying smaller batches…`);
      if (event.step === 'details') console.log(`    ${event.done}/${event.total} checked, ${event.kept} still on Jamendo`);
    },
  });
  if (songs.length === 0) throw new Error('No songs were found on Jamendo');
  console.log(`  moods: ${moodCounts(songs)}`);
  await saveCatalog('mtg-catalog', 'mtg-jamendo', songs);
  console.log('Restart "npm run dev" to use the new songs.');
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
