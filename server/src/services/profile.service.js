// The user's own profile (display name, favourite genres and languages).
import { unwrap } from '../lib/httpError.js';
import { withoutRetired } from '../data/taxonomy.js';

const COLUMNS = 'id,display_name,favorite_genres,favorite_languages,created_at,updated_at';
const OLD_COLUMNS = 'id,display_name,favorite_genres,created_at,updated_at';
const missingColumn = (result) => ['42703', 'PGRST204'].includes(result.error?.code);

// Works before migration 003 too (then without favourite languages).
async function withColumns(run) {
  let result = await run(COLUMNS);
  if (missingColumn(result)) {
    result = await run(OLD_COLUMNS);
    if (result.data) result.data = { ...result.data, favorite_languages: [] };
  }
  const profile = unwrap(result);
  return { ...profile, favorite_languages: withoutRetired(profile.favorite_languages ?? []) };
}

export async function getProfile(db, user) {
  const profile = await withColumns((columns) => db.from('profiles').select(columns).eq('id', user.id).single());
  return { ...profile, email: user.email };
}

export async function updateProfile(db, user, changes) {
  const profile = await withColumns((columns) => db.from('profiles').update(changes).eq('id', user.id).select(columns).single());
  return { ...profile, email: user.email };
}
