import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiRequest } from '../lib/api.js';
import { readJson, writeJson, removeKey } from '../lib/storage.js';
import { isValidSession, needsRefresh, secondsUntilRefresh, readSessionFromHash } from '../lib/session.js';

// Who is logged in. The login itself happens on the backend (which talks
// to Supabase Auth); the browser only keeps the session tokens.
//
// status: 'loading' | 'guest' | 'user'
// available: false when the server has no database, so accounts cannot work.
const SESSION_KEY = 'moodify.session.v1';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => {
    const stored = readJson(SESSION_KEY);
    return isValidSession(stored) ? stored : null;
  });
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState('loading');
  const [available, setAvailable] = useState(true);
  const [notice, setNotice] = useState(null); // e.g. a message from the email link
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const refreshing = useRef(null);

  const setSession = useCallback((next) => {
    sessionRef.current = next;
    setSessionState(next);
    if (next) writeJson(SESSION_KEY, next);
    else removeKey(SESSION_KEY);
  }, []);

  const signOutLocally = useCallback(() => {
    setSession(null);
    setProfile(null);
    setStatus('guest');
  }, [setSession]);

  // Gets a new access token with the refresh token (only one at a time).
  const refresh = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) throw Object.assign(new Error('Please log in first'), { status: 401 });
    refreshing.current ??= apiRequest('POST', '/auth/refresh', { body: { refresh_token: current.refresh_token } })
      .then((result) => {
        setSession(result.session);
        return result.session;
      })
      .catch((error) => {
        if (error.status === 401) signOutLocally();
        throw error;
      })
      .finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, [setSession, signOutLocally]);

  // Sends a request as the logged-in user. Renews the session when needed
  // and tries once more if the server says the token has expired.
  const authFetch = useCallback(
    async (method, path, options = {}) => {
      let current = sessionRef.current;
      if (!current) throw Object.assign(new Error('Please log in first'), { status: 401 });
      if (needsRefresh(current)) current = await refresh();
      try {
        return await apiRequest(method, path, { ...options, token: current.access_token });
      } catch (error) {
        if (error.status !== 401) throw error;
        const renewed = await refresh();
        return apiRequest(method, path, { ...options, token: renewed.access_token });
      }
    },
    [refresh],
  );

  const loadProfile = useCallback(async () => {
    const result = await authFetch('GET', '/auth/me');
    setProfile(result.profile);
    setStatus('user');
    return result.profile;
  }, [authFetch]);

  // On start: is the server able to do accounts? Did we arrive from an email link?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromLink = readSessionFromHash(window.location.hash);
      if (fromLink) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        if (fromLink.error) setNotice({ type: 'error', text: fromLink.error });
        if (fromLink.session) {
          setSession(fromLink.session);
          setNotice({ type: 'ok', text: 'Your email is confirmed. Welcome to MOODIFY!' });
        }
      }
      try {
        const health = await apiGet('/health');
        if (cancelled) return;
        if (!health.database?.configured) {
          setAvailable(false);
          setStatus('guest');
          return;
        }
      } catch {
        // Server unreachable: keep any saved session and try again later.
      }
      if (!sessionRef.current) {
        setStatus('guest');
        return;
      }
      try {
        await loadProfile();
      } catch (error) {
        if (!cancelled && error.status === 401) signOutLocally();
        else if (!cancelled) setStatus(sessionRef.current ? 'user' : 'guest');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Renew the session shortly before it expires, while the page is open.
  useEffect(() => {
    if (!session) return undefined;
    const timer = setTimeout(() => refresh().catch(() => {}), secondsUntilRefresh(session) * 1000);
    return () => clearTimeout(timer);
  }, [session, refresh]);

  const login = useCallback(
    async (email, password) => {
      const result = await apiRequest('POST', '/auth/login', { body: { email, password } });
      setSession(result.session);
      await loadProfile();
      return result.user;
    },
    [setSession, loadProfile],
  );

  const register = useCallback(
    async ({ email, password, display_name }) => {
      const result = await apiRequest('POST', '/auth/register', { body: { email, password, display_name: display_name || undefined } });
      if (result.session) {
        setSession(result.session);
        await loadProfile();
      }
      return result; // { needs_email_confirmation }
    },
    [setSession, loadProfile],
  );

  const logout = useCallback(async () => {
    try {
      await authFetch('POST', '/auth/logout');
    } catch {
      // Forget the session locally either way.
    }
    signOutLocally();
  }, [authFetch, signOutLocally]);

  const updateProfile = useCallback(
    async (changes) => {
      const result = await authFetch('PATCH', '/auth/me', { body: changes });
      setProfile(result.profile);
      return result.profile;
    },
    [authFetch],
  );

  const deleteAccount = useCallback(async () => {
    await authFetch('DELETE', '/auth/me', { body: { confirm: 'DELETE' } });
    signOutLocally();
  }, [authFetch, signOutLocally]);

  const value = useMemo(
    () => ({
      status,
      available,
      user: status === 'user' ? profile : null,
      notice,
      clearNotice: () => setNotice(null),
      login,
      register,
      logout,
      updateProfile,
      deleteAccount,
      authFetch,
    }),
    [status, available, profile, notice, login, register, logout, updateProfile, deleteAccount, authFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
