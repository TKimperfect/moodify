// Registration, login and session renewal, all through Supabase Auth.
// Passwords are sent to Supabase and never stored or logged by MOODIFY.
import { createAuthClient, createAdminClient, hasSecretKey } from '../lib/supabase.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/httpError.js';

const publicUser = (user) => ({
  id: user.id,
  email: user.email ?? null,
  display_name: user.user_metadata?.display_name ?? null,
});

const publicSession = (session) =>
  session && {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };

export async function register({ email, password, display_name }) {
  const { data, error } = await createAuthClient().auth.signUp({
    email,
    password,
    options: {
      data: display_name ? { display_name } : {},
      // The confirmation email links back to MOODIFY's login page.
      emailRedirectTo: `${env.clientOrigin}/login`,
    },
  });
  if (error) {
    if (error.code === 'user_already_exists') throw new HttpError(409, 'An account with this email already exists');
    if (error.status === 429) throw new HttpError(429, 'Too many attempts. Please wait a little and try again');
    if (error.status && error.status < 500) throw new HttpError(400, error.message);
    console.error('Supabase sign-up failed:', error.message);
    throw new HttpError(502, 'The account service is not available right now');
  }
  return {
    user: publicUser(data.user),
    session: publicSession(data.session),
    // When Supabase requires email confirmation there is no session yet.
    needs_email_confirmation: !data.session,
  };
}

export async function login({ email, password }) {
  const { data, error } = await createAuthClient().auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === 'email_not_confirmed') throw new HttpError(403, 'Please confirm your email address first');
    if (error.status === 429) throw new HttpError(429, 'Too many attempts. Please wait a little and try again');
    if (error.status && error.status < 500) throw new HttpError(401, 'Wrong email or password');
    console.error('Supabase sign-in failed:', error.message);
    throw new HttpError(502, 'The account service is not available right now');
  }
  return { user: publicUser(data.user), session: publicSession(data.session) };
}

export async function refresh({ refresh_token }) {
  const { data, error } = await createAuthClient().auth.refreshSession({ refresh_token });
  if (error || !data.session) throw new HttpError(401, 'Your session has expired. Please log in again');
  return { user: publicUser(data.user), session: publicSession(data.session) };
}

// Ends the session on Supabase's side. Failing to do so is not an error
// for the user: the app forgets the tokens either way.
export async function logout(accessToken) {
  try {
    await createAuthClient().auth.admin.signOut(accessToken);
  } catch {
    // ignore
  }
}

// Permanently deletes the account. Favourites, playlists, history and mood
// sessions are removed with it (the database deletes them automatically).
export async function deleteAccount(userId) {
  if (!hasSecretKey) throw new HttpError(501, 'Deleting accounts needs SUPABASE_SECRET_KEY on the server');
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error('Account deletion failed:', error.message);
    throw new HttpError(502, 'The account could not be deleted right now');
  }
}
