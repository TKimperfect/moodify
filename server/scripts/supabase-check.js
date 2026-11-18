// End-to-end self-check of the Supabase setup.
// Run from the "moodify" folder with:  npm run db:check
//
// It creates two temporary test users, exercises every account feature
// through the real MOODIFY API, confirms one user cannot see the other's
// data, and then deletes the test users again.
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createAdminClient, createUserClient, hasSecretKey, isSupabaseConfigured } from '../src/lib/supabase.js';

let failures = 0;
const pass = (label) => console.log(`  ✓ ${label}`);
const fail = (label, detail) => {
  failures += 1;
  console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`);
};
const check = (label, condition, detail) => (condition ? pass(label) : fail(label, detail));

if (!isSupabaseConfigured || !hasSecretKey) {
  console.error('✗ Fill in SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in server/.env first.');
  process.exit(1);
}

const admin = createAdminClient();
const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api`;

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // no body (204)
  }
  return { status: response.status, json, error: json?.error?.message };
}

const tag = randomBytes(5).toString('hex');
const password = `Check-${randomBytes(9).toString('base64url')}`;
const people = [
  { email: `moodify-check-a-${tag}@example.com`, name: 'Check A' },
  { email: `moodify-check-b-${tag}@example.com`, name: 'Check B' },
];
const created = [];

try {
  console.log('\n1. Database');
  const health = await call('GET', '/health');
  check('server reaches Supabase', health.json?.database?.connected === true, health.json?.database?.note);
  check(`songs come from Supabase (${health.json?.database?.songs ?? 0} songs)`, health.json?.database?.song_source === 'supabase', 'Run: npm run db:seed');

  console.log('\n2. Accounts');
  for (const person of people) {
    const { data, error } = await admin.auth.admin.createUser({
      email: person.email,
      password,
      email_confirm: true,
      user_metadata: { display_name: person.name },
    });
    if (error) throw new Error(`Could not create a test user: ${error.message}`);
    created.push(data.user.id);
    const login = await call('POST', '/auth/login', { body: { email: person.email, password } });
    if (login.status !== 200) throw new Error(`Login failed (${login.status}): ${login.error}`);
    person.token = login.json.session.access_token;
    person.refresh = login.json.session.refresh_token;
    person.id = login.json.user.id;
  }
  const [a, b] = people;
  pass('two test users created and logged in');

  const wrong = await call('POST', '/auth/login', { body: { email: a.email, password: 'definitely-wrong' } });
  check('wrong password is refused', wrong.status === 401, `status ${wrong.status}`);

  const me = await call('GET', '/auth/me', { token: a.token });
  check('profile row was created automatically', me.json?.profile?.display_name === 'Check A', me.error ?? JSON.stringify(me.json));

  const renamed = await call('PATCH', '/auth/me', { token: a.token, body: { display_name: 'Renamed', favorite_genres: ['indie', 'jazz'] } });
  check('profile can be updated', renamed.json?.profile?.display_name === 'Renamed' && renamed.json?.profile?.favorite_genres?.length === 2, renamed.error);

  const refreshed = await call('POST', '/auth/refresh', { body: { refresh_token: a.refresh } });
  check('session can be renewed', refreshed.status === 200 && Boolean(refreshed.json?.session?.access_token), refreshed.error);
  if (refreshed.status === 200) a.token = refreshed.json.session.access_token;

  const noToken = await call('GET', '/favorites');
  check('requests without login are refused', noToken.status === 401, `status ${noToken.status}`);
  const badToken = await call('GET', '/favorites', { token: 'not-a-real-token' });
  check('requests with a fake token are refused', badToken.status === 401, `status ${badToken.status}`);

  console.log('\n3. Favourites');
  const songs = (await call('GET', '/songs?limit=5')).json.songs.map((song) => song.id);
  const [s1, s2, s3] = songs;
  check('add favourite', (await call('PUT', `/favorites/${s1}`, { token: a.token })).status === 204);
  check('adding the same favourite twice is harmless', (await call('PUT', `/favorites/${s1}`, { token: a.token })).status === 204);
  const favorites = await call('GET', '/favorites', { token: a.token });
  check('list favourites', favorites.json?.count === 1 && favorites.json.favorites[0].song.id === s1, favorites.error ?? JSON.stringify(favorites.json));
  check('unknown song is refused', (await call('PUT', '/favorites/this-song-does-not-exist', { token: a.token })).status === 404);

  console.log('\n4. Mood sessions');
  const profile = { moods: ['sad', 'lonely'], energy: 20, intensity: 85, genres: ['indie'], desired_effect: 'comfort', tempo: 'slow' };
  const session = await call('POST', '/mood-sessions', { token: a.token, body: { profile } });
  check('save mood session', session.status === 201 && session.json?.mood_session?.desired_effect === 'comfort', session.error);
  const sessionId = session.json?.mood_session?.id;
  const sessions = await call('GET', '/mood-sessions', { token: a.token });
  check('list mood sessions', sessions.json?.count === 1, sessions.error);

  console.log('\n5. Playlists');
  const made = await call('POST', '/playlists', { token: a.token, body: { name: 'Check playlist', mood_session_id: sessionId, song_ids: [s1, s2] } });
  check('create playlist with songs', made.status === 201 && made.json?.playlist?.song_count === 2, made.error);
  const playlistId = made.json?.playlist?.id;
  const added = await call('POST', `/playlists/${playlistId}/songs`, { token: a.token, body: { song_id: s3 } });
  check('add song keeps order', added.status === 201 && added.json?.playlist?.songs?.map((entry) => entry.song.id).join() === [s1, s2, s3].join(), added.error);
  check('duplicate song is refused', (await call('POST', `/playlists/${playlistId}/songs`, { token: a.token, body: { song_id: s3 } })).status === 409);
  const removed = await call('DELETE', `/playlists/${playlistId}/songs/${s2}`, { token: a.token });
  check('remove song', removed.json?.playlist?.song_count === 2, removed.error);
  const patched = await call('PATCH', `/playlists/${playlistId}`, { token: a.token, body: { name: 'Renamed playlist' } });
  check('rename playlist', patched.json?.playlist?.name === 'Renamed playlist', patched.error);
  const listed = await call('GET', '/playlists', { token: a.token });
  check('list playlists with song counts', listed.json?.count === 1 && listed.json.playlists[0].song_count === 2, listed.error ?? JSON.stringify(listed.json));

  console.log('\n6. Listening history and learning');
  const rejectedEvent = await call('POST', '/history', { token: a.token, body: { song_id: s1, event: 'rejected', mood_session_id: sessionId } });
  check('record "not for me"', rejectedEvent.status === 201, rejectedEvent.error);
  check('record play', (await call('POST', '/history', { token: a.token, body: { song_id: s2, event: 'played' } })).status === 201);
  const history = await call('GET', '/history', { token: a.token });
  check('list history', history.json?.count === 2, history.error);
  const recs = await call('POST', '/recommendations', { token: a.token, body: { profile: { ...profile, genres: [] }, limit: 20 } });
  const recIds = [...(recs.json?.recommendations ?? []), ...(recs.json?.reserve ?? [])].map((item) => item.song.id);
  check('recommendations are personalised and skip rejected songs', recs.json?.personalised === true && recIds.length > 0 && !recIds.includes(s1), recs.error);
  const undone = await call('DELETE', `/history/rejections/${s1}`, { token: a.token });
  check('undo "not for me"', undone.json?.removed === 1, undone.error);
  check('record skip', (await call('POST', '/history', { token: a.token, body: { song_id: s3, event: 'skipped' } })).status === 201);
  const withGenres = await call('POST', '/recommendations', { token: a.token, body: { profile: { ...profile, genres: [] } } });
  check(
    'favourite genres from the profile are used when none are chosen',
    withGenres.json?.used_favorite_genres === true && withGenres.json?.profile?.genres?.join() === 'indie,jazz',
    withGenres.error ?? JSON.stringify(withGenres.json?.profile),
  );

  console.log('\n7. Privacy: user B must not see or change user A\'s data');
  check("B's favourites are empty", (await call('GET', '/favorites', { token: b.token })).json?.count === 0);
  check("B's playlists are empty", (await call('GET', '/playlists', { token: b.token })).json?.count === 0);
  check("B cannot open A's playlist", (await call('GET', `/playlists/${playlistId}`, { token: b.token })).status === 404);
  check("B cannot add to A's playlist", (await call('POST', `/playlists/${playlistId}/songs`, { token: b.token, body: { song_id: s2 } })).status === 404);
  check("B cannot delete A's playlist", (await call('DELETE', `/playlists/${playlistId}`, { token: b.token })).status === 404);
  check("B cannot delete A's mood session", (await call('DELETE', `/mood-sessions/${sessionId}`, { token: b.token })).status === 404);
  // Straight to the database as B, bypassing the MOODIFY API: RLS must still hold.
  const direct = createUserClient(b.token);
  const peek = await direct.from('playlists').select('id').eq('id', playlistId);
  check('database itself hides A\'s playlist from B (RLS)', !peek.error && peek.data.length === 0, peek.error?.message);
  const forge = await direct.from('favorites').insert({ user_id: a.id, song_id: s2 });
  check('database refuses B writing as A (RLS)', Boolean(forge.error), 'insert unexpectedly succeeded');
  const songWrite = await direct.from('songs').update({ title: 'hacked' }).eq('id', s1).select('id');
  check('users cannot edit songs', Boolean(songWrite.error) || songWrite.data.length === 0, 'update unexpectedly succeeded');

  console.log('\n8. Clean-up through the API');
  check('delete playlist', (await call('DELETE', `/playlists/${playlistId}`, { token: a.token })).status === 204);
  check('remove favourite', (await call('DELETE', `/favorites/${s1}`, { token: a.token })).status === 204);
  check('delete mood session', (await call('DELETE', `/mood-sessions/${sessionId}`, { token: a.token })).status === 204);
  check('log out', (await call('POST', '/auth/logout', { token: a.token })).status === 204);

  console.log('\n9. Deleting an account removes all of its data');
  const sessionB = await call('POST', '/mood-sessions', { token: b.token, body: { profile } });
  await call('PUT', `/favorites/${s1}`, { token: b.token });
  check('delete needs typed confirmation', (await call('DELETE', '/auth/me', { token: b.token, body: {} })).status === 400);
  const deleted = await call('DELETE', '/auth/me', { token: b.token, body: { confirm: 'DELETE' } });
  check('delete account', deleted.status === 204, deleted.error);
  if (deleted.status === 204) {
    created.splice(created.indexOf(b.id), 1); // already gone
    const leftovers = await admin.from('mood_sessions').select('id').eq('user_id', b.id);
    const leftFavorites = await admin.from('favorites').select('song_id').eq('user_id', b.id);
    check('their mood sessions and favourites were removed', !leftovers.error && leftovers.data.length === 0 && leftFavorites.data?.length === 0 && Boolean(sessionB.json));
    const relogin = await call('POST', '/auth/login', { body: { email: b.email, password } });
    check('the deleted account can no longer log in', relogin.status === 401, `status ${relogin.status}`);
  }
} catch (error) {
  fail('check stopped early', error.message);
} finally {
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`  ! Could not delete test user ${id}: ${error.message} (delete it in Authentication > Users)`);
  }
  server.close();
}

console.log(failures === 0 ? '\n✓ ALL CHECKS PASSED. Supabase is set up correctly.\n' : `\n✗ ${failures} check(s) failed. Copy this whole output and send it over.\n`);
process.exit(failures === 0 ? 0 : 1);
