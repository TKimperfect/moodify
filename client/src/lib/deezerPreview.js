// Deezer only gives a 30-second preview for songs that are licensed in the
// listener's country. The MOODIFY server runs in the USA, so for many songs
// (Korean, Mandarin, Malay...) it gets no preview at all. Instead the browser
// asks Deezer itself, from the listener's own country. Deezer's API allows
// this from web pages through "JSONP" (a small script tag).
const PREVIEW_TTL_MS = 15 * 60 * 1000; // preview links stop working after a while
const cache = new Map();
let counter = 0;

export function deezerTrackId(song) {
  if (song?.playback?.source !== 'deezer') return null;
  const match = /^deezer-(\d+)$/.exec(song.id ?? '');
  return match ? match[1] : null;
}

// Loads https://api.deezer.com/... as a script and returns its JSON.
export function loadJsonp(url, { timeoutMs = 8000, doc = globalThis.document, win = globalThis } = {}) {
  return new Promise((resolve, reject) => {
    if (!doc) return reject(new Error('No browser'));
    counter += 1;
    const name = `__moodifyDeezer${Date.now()}_${counter}`;
    const script = doc.createElement('script');
    const done = () => {
      clearTimeout(timer);
      delete win[name];
      script.remove();
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('Deezer did not answer'));
    }, timeoutMs);
    win[name] = (data) => {
      done();
      resolve(data);
    };
    script.onerror = () => {
      done();
      reject(new Error('Could not reach Deezer'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${name}`;
    doc.head.appendChild(script);
  });
}

// The preview link for a Deezer track, as seen from this browser's country.
// Returns null when Deezer has no preview here either.
export async function deezerPreview(trackId, { jsonp = loadJsonp, now = Date.now } = {}) {
  const cached = cache.get(trackId);
  if (cached && cached.expires > now()) return cached.url;
  const data = await jsonp(`https://api.deezer.com/track/${encodeURIComponent(trackId)}`);
  const url = typeof data?.preview === 'string' && data.preview.startsWith('https://') ? data.preview : null;
  if (cache.size > 500) cache.clear();
  if (url) cache.set(trackId, { url, expires: now() + PREVIEW_TTL_MS });
  return url;
}
