// Pure helpers for the login session (no React), so they are easy to test.

// Seconds before expiry at which the session is renewed.
export const REFRESH_MARGIN_S = 120;

// A session is { access_token, refresh_token, expires_at } (expires_at in seconds).
export function isValidSession(session) {
  return Boolean(
    session &&
      typeof session.access_token === 'string' &&
      session.access_token.length > 0 &&
      typeof session.refresh_token === 'string' &&
      session.refresh_token.length > 0 &&
      Number.isFinite(Number(session.expires_at)),
  );
}

export function secondsUntilRefresh(session, nowMs = Date.now()) {
  return Math.max(0, Number(session.expires_at) - REFRESH_MARGIN_S - Math.floor(nowMs / 1000));
}

export const needsRefresh = (session, nowMs = Date.now()) => secondsUntilRefresh(session, nowMs) === 0;

// After clicking the link in Supabase's confirmation email, the browser lands
// on /login#access_token=...&refresh_token=...&expires_at=... (or #error=...).
export function readSessionFromHash(hash) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  if (params.get('error') || params.get('error_description')) {
    return { error: params.get('error_description') || params.get('error') };
  }
  const session = {
    access_token: params.get('access_token') ?? '',
    refresh_token: params.get('refresh_token') ?? '',
    expires_at: Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(params.get('expires_in') || 3600),
  };
  return isValidSession(session) ? { session } : null;
}
