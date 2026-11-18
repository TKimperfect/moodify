// Saved mood profiles ("mood sessions"): the user's mood history.
import { unwrap, HttpError } from '../lib/httpError.js';

const COLUMNS = 'id,moods,energy,intensity,genres,desired_effect,tempo,source,created_at';

export async function saveMoodSession(db, userId, { profile, source }) {
  return unwrap(await db.from('mood_sessions').insert({ user_id: userId, ...profile, source }).select(COLUMNS).single());
}

export async function listMoodSessions(db, { limit }) {
  return unwrap(await db.from('mood_sessions').select(COLUMNS).order('created_at', { ascending: false }).limit(limit));
}

export async function deleteMoodSession(db, id) {
  const removed = unwrap(await db.from('mood_sessions').delete().eq('id', id).select('id'));
  if (removed.length === 0) throw new HttpError(404, 'Mood session not found');
}
