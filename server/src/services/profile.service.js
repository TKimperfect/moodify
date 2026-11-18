// The user's own profile (display name and favourite genres).
import { unwrap } from '../lib/httpError.js';

const COLUMNS = 'id,display_name,favorite_genres,created_at,updated_at';

export async function getProfile(db, user) {
  const profile = unwrap(await db.from('profiles').select(COLUMNS).eq('id', user.id).single());
  return { ...profile, email: user.email };
}

export async function updateProfile(db, user, changes) {
  const profile = unwrap(await db.from('profiles').update(changes).eq('id', user.id).select(COLUMNS).single());
  return { ...profile, email: user.email };
}
