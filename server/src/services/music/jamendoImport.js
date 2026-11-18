// Builds a catalogue of Creative Commons songs from Jamendo, a batch per mood.
import { fetchTracksForMood, mapJamendoTrack } from './providers/jamendo.provider.js';

// Jamendo tags to search for each MOODIFY mood, most specific first.
// Jamendo's tag vocabulary is not fully documented, so each mood has
// several candidates: if the combined search finds too little, the tags
// are tried one by one until there are enough songs.
export const MOOD_QUERIES = {
  happy: ['happy', 'joyful', 'uplifting', 'positive'],
  sad: ['sad', 'melancholic', 'melancholy', 'emotional', 'sorrow', 'dark', 'piano'],
  lonely: ['lonely', 'loneliness', 'melancholy', 'introspective', 'sad', 'acoustic'],
  angry: ['aggressive', 'angry', 'heavy'],
  anxious: ['tense', 'suspense', 'dark'],
  calm: ['calm', 'relaxing', 'peaceful'],
  nostalgic: ['nostalgic', 'nostalgia', 'retro', 'vintage', '80s', 'oldschool'],
  motivated: ['energetic', 'motivational', 'inspiring'],
  empty: ['ambient', 'atmospheric', 'meditative', 'minimal', 'drone', 'chillout'],
  romantic: ['romantic', 'love', 'sensual'],
};

// All the tracks for one mood: the combined search first, then single tags.
async function tracksForMood(tags, perMood) {
  const found = new Map();
  const add = (tracks) => tracks.forEach((track) => found.size < perMood && !found.has(track.id) && found.set(track.id, track));

  add(await fetchTracksForMood(tags, { limit: perMood }));
  for (const tag of tags) {
    if (found.size >= perMood / 2) break;
    add(await fetchTracksForMood([tag], { limit: perMood }));
  }
  return [...found.values()];
}

export async function importJamendo({ perMood = 30, onProgress = () => {} } = {}) {
  const byId = new Map();
  const failures = [];

  for (const [mood, tags] of Object.entries(MOOD_QUERIES)) {
    try {
      const tracks = await tracksForMood(tags, perMood);
      tracks.forEach((track, rank) => {
        const song = mapJamendoTrack(track, { hintMood: mood, rank });
        const existing = byId.get(song.id);
        if (existing) {
          // Found under two moods: keep both (at most three).
          existing.moods = [...new Set([...existing.moods, mood])].slice(0, 3);
        } else {
          byId.set(song.id, song);
        }
      });
      onProgress({ mood, found: tracks.length });
    } catch (error) {
      // A problem with one mood should not lose the others, unless the key is wrong.
      if (/client_id|not configured/i.test(error.message)) throw error;
      failures.push({ mood, error: error.message });
      onProgress({ mood, found: 0, error: error.message });
    }
  }
  return { songs: [...byId.values()], failures };
}
