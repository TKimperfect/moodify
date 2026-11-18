import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSession, needsRefresh, secondsUntilRefresh, readSessionFromHash } from './session.js';

const now = Date.UTC(2026, 0, 1) ;
const nowS = now / 1000;

test('valid sessions need both tokens and an expiry time', () => {
  assert.equal(isValidSession({ access_token: 'a', refresh_token: 'r', expires_at: nowS + 3600 }), true);
  assert.equal(isValidSession({ access_token: 'a', expires_at: nowS }), false);
  assert.equal(isValidSession(null), false);
  assert.equal(isValidSession({ access_token: '', refresh_token: 'r', expires_at: 1 }), false);
});

test('sessions are renewed two minutes before they expire', () => {
  const session = { access_token: 'a', refresh_token: 'r', expires_at: nowS + 3600 };
  assert.equal(secondsUntilRefresh(session, now), 3480);
  assert.equal(needsRefresh(session, now), false);
  assert.equal(needsRefresh({ ...session, expires_at: nowS + 60 }, now), true);
  assert.equal(needsRefresh({ ...session, expires_at: nowS - 10 }, now), true);
});

test('reads the session from the email confirmation link', () => {
  const result = readSessionFromHash(`#access_token=abc&refresh_token=def&expires_at=${nowS + 3600}&type=signup`);
  assert.deepEqual(result, { session: { access_token: 'abc', refresh_token: 'def', expires_at: nowS + 3600 } });
  assert.deepEqual(readSessionFromHash('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired'), {
    error: 'Email link is invalid or has expired',
  });
  assert.equal(readSessionFromHash(''), null);
  assert.equal(readSessionFromHash('#something=else'), null);
});
