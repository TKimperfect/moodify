// Small helper for calling music provider APIs with a timeout.
import { HttpError } from '../../../lib/httpError.js';

export async function fetchJson(url, providerName, { timeoutMs = 10_000, headers } = {}) {
  let response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new HttpError(503, `${providerName} could not be reached`);
  }
  if (response.status === 429) throw new HttpError(503, `${providerName} is busy right now. Try again in a minute`);
  if (!response.ok) throw new HttpError(502, `${providerName} returned an error (${response.status})`);
  try {
    return await response.json();
  } catch {
    throw new HttpError(502, `${providerName} sent an unreadable reply`);
  }
}

// Remembers recent search results for a short time, to be polite to the APIs.
export function createCache(ttlMs = 60_000, max = 200) {
  const entries = new Map();
  return {
    get(key) {
      const hit = entries.get(key);
      if (!hit || hit.expires < Date.now()) return undefined;
      return hit.value;
    },
    set(key, value) {
      if (entries.size >= max) entries.delete(entries.keys().next().value);
      entries.set(key, { value, expires: Date.now() + ttlMs });
    },
    clear() {
      entries.clear();
    },
  };
}
