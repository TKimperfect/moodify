// When to try a request again (pure logic, easy to test).
//
// Free hosting (Render) puts the server to sleep after 15 minutes without
// visitors; waking up takes up to about a minute. During that time requests
// fail with "unreachable" (0) or 502/503/504. Reading data is safe to repeat,
// so those requests wait and try again for a little over a minute.
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 20000, 20000];

export const isTemporaryFailure = (status) => status === 0 || status === 502 || status === 503 || status === 504;

// Returns how long to wait before attempt number "attempt" (1 = first retry),
// or null when it is time to give up.
export function nextRetryDelay(attempt, status) {
  if (!isTemporaryFailure(status)) return null;
  return RETRY_DELAYS_MS[attempt - 1] ?? null;
}
