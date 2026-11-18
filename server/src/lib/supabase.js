// Creates connections to Supabase. Nothing else in the app reads the keys.
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';

const { url, publishableKey, secretKey } = env.supabase;

// The server never stores a login session of its own.
const STATELESS = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const hasSecretKey = Boolean(url && secretKey);

export function assertSupabase() {
  if (!isSupabaseConfigured) {
    throw new HttpError(503, 'Accounts are not available: the database is not configured on this server');
  }
}

// Shared client for PUBLIC data only (songs, moods). It is never used to
// sign anyone in, so it never carries a user's identity.
let publicClient = null;
export function getPublicClient() {
  assertSupabase();
  publicClient ??= createClient(url, publishableKey, STATELESS);
  return publicClient;
}

// A fresh client for one sign-in / sign-up / token check, thrown away after.
export function createAuthClient() {
  assertSupabase();
  return createClient(url, publishableKey, STATELESS);
}

// A client that acts AS one logged-in user. The database's Row Level
// Security then guarantees it can only touch that user's rows.
export function createUserClient(accessToken) {
  assertSupabase();
  return createClient(url, publishableKey, {
    ...STATELESS,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Full-access client. Used ONLY by the scripts in server/scripts
// (seeding songs, self-check). Never used to answer a web request.
export function createAdminClient() {
  if (!hasSecretKey) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in server/.env');
  return createClient(url, secretKey, STATELESS);
}
