// Safe wrappers around the browser's storage.
// Storage can be unavailable (private windows, blocked cookies),
// so every call is guarded and the app keeps working without it.
//   localStorage   - kept until cleared (mood profile, likes)
//   sessionStorage - kept only while this browser tab is open (chat)
function area(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readJson(key, kind = 'local') {
  try {
    const raw = area(kind)?.getItem(key);
    return raw === null || raw === undefined ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(key, value, kind = 'local') {
  try {
    area(kind)?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key, kind = 'local') {
  try {
    area(kind)?.removeItem(key);
  } catch {
    // Nothing to do: storage is unavailable.
  }
}
