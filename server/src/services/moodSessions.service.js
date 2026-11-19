// Saved mood profiles ("mood sessions"): the user's mood history.
import { unwrap, HttpError } from '../lib/httpError.js';
import { withoutRetired } from '../data/taxonomy.js';

const COLUMNS = 'id,moods,energy,intensity,genres,desired_effect,tempo,languages,source,created_at';
const OLD_COLUMNS = 'id,moods,energy,intensity,genres,desired_effect,tempo,source,created_at';
const missingColumn = (result) => ['42703', 'PGRST204'].includes(result.error?.code);

export async function saveMoodSession(db, userId, { profile, source }) {
  let result = await db.from('mood_sessions').insert({ user_id: userId, ...profile, source }).select(COLUMNS).single();
  if (missingColumn(result)) {
    // Before migration 003: save without languages.
    const { languages, ...rest } = profile;
    result = await db.from('mood_sessions').insert({ user_id: userId, ...rest, source }).select(OLD_COLUMNS).single();
  }
  return unwrap(result);
}

export async function listMoodSessions(db, { limit }) {
  let result = await db.from('mood_sessions').select(COLUMNS).order('created_at', { ascending: false }).limit(limit);
  if (missingColumn(result)) result = await db.from('mood_sessions').select(OLD_COLUMNS).order('created_at', { ascending: false }).limit(limit);
  return unwrap(result).map((session) => ({ ...session, languages: withoutRetired(session.languages ?? []) }));
}

export async function deleteMoodSession(db, id) {
  const removed = unwrap(await db.from('mood_sessions').delete().eq('id', id).select('id'));
  if (removed.length === 0) throw new HttpError(404, 'Mood session not found');
}
