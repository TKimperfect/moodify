import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRetryDelay, isTemporaryFailure, RETRY_DELAYS_MS } from './retry.js';

test('only temporary failures are retried', () => {
  for (const status of [0, 502, 503, 504]) assert.equal(isTemporaryFailure(status), true);
  for (const status of [400, 401, 403, 404, 409, 429, 500]) assert.equal(isTemporaryFailure(status), false);
  assert.equal(nextRetryDelay(1, 404), null);
});

test('waits longer each time and gives up after about a minute', () => {
  assert.equal(nextRetryDelay(1, 0), 1000);
  assert.ok(nextRetryDelay(3, 502) > nextRetryDelay(2, 502));
  assert.equal(nextRetryDelay(RETRY_DELAYS_MS.length + 1, 503), null);
  const total = RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
  assert.ok(total >= 60_000 && total <= 90_000, `total wait ${total}ms`);
});
