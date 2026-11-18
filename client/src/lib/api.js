// One small helper that every page uses to talk to the backend.
// If the backend address ever changes, this is the only file to edit.
import { nextRetryDelay } from './retry.js';

const BASE_URL = (import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '');

// Pages can listen for these to show "the server is waking up".
function announce(waiting) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('moodify:server', { detail: { waiting } }));
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    });
  });

// Turns a backend address like "/api/audio/x.wav" into a full address
// (needed in production, where frontend and backend live on different domains).
export function resolveApiUrl(url) {
  if (!url) return null;
  return url.startsWith('/api/') ? `${BASE_URL}${url}` : url;
}

function withQuery(path, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  }
  return query.size > 0 ? `${path}?${query}` : path;
}

// Sends one request. "token" is the logged-in user's access token (optional).
// Errors carry the HTTP status in error.status (0 = server unreachable).
// Reading (GET) is retried while the server is waking up; other methods only
// when "retry: true" is passed (for requests that are safe to repeat).
export async function apiRequest(method, path, options = {}) {
  const retry = options.retry ?? method === 'GET';
  for (let attempt = 1; ; attempt += 1) {
    try {
      const result = await sendOnce(method, path, options);
      if (attempt > 1) announce(false);
      return result;
    } catch (error) {
      const delay = retry ? nextRetryDelay(attempt, error.status) : null;
      if (delay === null) {
        if (attempt > 1) announce(false);
        throw error;
      }
      announce(true);
      await sleep(delay, options.signal);
    }
  }
}

async function sendOnce(method, path, { body, params, token, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}/api${withQuery(path, params)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error; // request was cancelled on purpose
    throw Object.assign(new Error('Cannot reach the MOODIFY server'), { status: 0 });
  }

  if (response.status === 204) return null;

  let data = null;
  try {
    data = await response.json();
  } catch {
    // The reply was not JSON (for example the backend is switched off).
  }

  if (!response.ok) {
    if (!data?.error && [502, 503, 504].includes(response.status)) {
      throw Object.assign(new Error('The MOODIFY server is not responding right now'), { status: response.status });
    }
    const message = data?.error?.details?.[0]?.message
      ? `${data.error.message}: ${data.error.details[0].message}`
      : (data?.error?.message ?? `Request failed (${response.status})`);
    throw Object.assign(new Error(message), { status: response.status });
  }
  if (data === null) throw Object.assign(new Error('The server sent an unreadable reply'), { status: response.status });
  return data;
}

// Reads data. "params" become the ?key=value part of the address.
export function apiGet(path, { params, signal, token } = {}) {
  return apiRequest('GET', path, { params, signal, token });
}

// Sends data.
export function apiPost(path, body, { signal, token, retry } = {}) {
  return apiRequest('POST', path, { body, signal, token, retry });
}
