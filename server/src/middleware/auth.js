// Works out WHO is making a request from the "Authorization: Bearer <token>"
// header. The token is checked with Supabase on every request.
import { createAuthClient, createUserClient, isSupabaseConfigured, assertSupabase } from '../lib/supabase.js';
import { HttpError } from '../lib/httpError.js';

function readToken(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

async function identify(token) {
  const { data, error } = await createAuthClient().auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

// For routes that only logged-in users may use.
export async function requireAuth(req, res, next) {
  assertSupabase();
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Please log in first');
  const user = await identify(token);
  if (!user) throw new HttpError(401, 'Your session has expired. Please log in again');
  req.user = user;
  req.accessToken = token;
  req.db = createUserClient(token); // acts as this user; RLS applies
  next();
}

// For routes that work for everyone but do more for logged-in users.
export async function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token && isSupabaseConfigured) {
    try {
      const user = await identify(token);
      if (user) {
        req.user = user;
        req.accessToken = token;
        req.db = createUserClient(token);
      }
    } catch {
      // Treat any problem as "not logged in".
    }
  }
  next();
}
