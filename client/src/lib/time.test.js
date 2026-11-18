import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeAgo } from './time.js';

test('timeAgo reads naturally', () => {
  const now = Date.UTC(2026, 5, 15, 12);
  const ago = (ms) => timeAgo(new Date(now - ms).toISOString(), now);
  assert.equal(ago(10_000), 'just now');
  assert.equal(ago(60_000), '1 minute ago');
  assert.equal(ago(5 * 60_000), '5 minutes ago');
  assert.equal(ago(3 * 3_600_000), '3 hours ago');
  assert.equal(ago(26 * 3_600_000), 'yesterday');
  assert.equal(ago(3 * 86_400_000), '3 days ago');
  assert.equal(timeAgo('not a date', now), '');
});
