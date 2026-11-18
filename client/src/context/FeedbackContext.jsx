import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { readJson, writeJson } from '../lib/storage.js';
import { useAuth } from './AuthContext.jsx';

// Remembers what the user thinks of songs so recommendations can learn:
//   liked    - songs marked as favourite
//   rejected - songs marked "not for me" (never recommended again)
//   recent   - songs shown lately, newest first (used to avoid repeats)
//   skipped  - songs skipped early in the player (a gentle "less like this")
//
// Always kept in this browser. When the user is logged in, every change is
// also saved to their account, and on login the two are merged.
const STORAGE_KEY = 'moodify.feedback.v1';
const MAX_RECENT = 40;
const MAX_UPLOAD = 50;
const FeedbackContext = createContext(null);

const isId = (id) => typeof id === 'string' && /^[a-z0-9-]{1,80}$/.test(id);
const cleanIds = (value) => (Array.isArray(value) ? [...new Set(value.filter(isId))] : []);

function load() {
  const stored = readJson(STORAGE_KEY);
  return {
    liked: cleanIds(stored?.liked),
    rejected: cleanIds(stored?.rejected),
    recent: cleanIds(stored?.recent).slice(0, MAX_RECENT),
    skipped: cleanIds(stored?.skipped).slice(0, MAX_RECENT),
  };
}

export function FeedbackProvider({ children }) {
  const [feedback, setFeedback] = useState(load);
  const { status, user, authFetch } = useAuth();
  const loggedIn = status === 'user';
  const [syncedFor, setSyncedFor] = useState(null);
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  useEffect(() => {
    writeJson(STORAGE_KEY, feedback);
  }, [feedback]);

  // Saves one change to the account; problems never block the page.
  const sync = useCallback(
    (method, path, body) => {
      if (!loggedIn) return;
      authFetch(method, path, { body }).catch((error) => {
        if (error.status !== 404 && error.status !== 409) console.warn('Could not save to your account:', error.message);
      });
    },
    [loggedIn, authFetch],
  );

  // On login: bring in the account's likes and "not for me" songs, and
  // upload the ones made on this device before logging in.
  const mergedFor = useRef(null);
  useEffect(() => {
    if (!loggedIn || !user || mergedFor.current === user.id) return;
    mergedFor.current = user.id;
    (async () => {
      try {
        const [favorites, rejections] = await Promise.all([
          authFetch('GET', '/favorites'),
          authFetch('GET', '/history', { params: { event: 'rejected', limit: 100 } }),
        ]);
        const serverLiked = favorites.favorites.map((item) => item.song.id);
        const serverRejected = rejections.history.map((item) => item.song.id);
        const local = feedbackRef.current;
        const uploadLikes = local.liked.filter((id) => !serverLiked.includes(id)).slice(0, MAX_UPLOAD);
        const uploadRejections = local.rejected.filter((id) => !serverRejected.includes(id)).slice(0, MAX_UPLOAD);
        for (const id of uploadLikes) await authFetch('PUT', `/favorites/${id}`).catch(() => {});
        for (const id of uploadRejections) await authFetch('POST', '/history', { body: { song_id: id, event: 'rejected' } }).catch(() => {});
        setFeedback((current) => ({
          ...current,
          liked: [...new Set([...current.liked, ...serverLiked])],
          rejected: [...new Set([...current.rejected, ...serverRejected])],
        }));
      } catch (error) {
        console.warn('Could not load your saved likes:', error.message);
      }
      setSyncedFor(user.id);
    })();
  }, [loggedIn, user, authFetch]);

  // Logging out keeps this device's copy (the user may keep listening).
  useEffect(() => {
    if (!loggedIn) mergedFor.current = null;
  }, [loggedIn]);

  const toggleLike = useCallback(
    (id) => {
      const liked = feedbackRef.current.liked.includes(id);
      setFeedback((current) => ({
        ...current,
        liked: liked ? current.liked.filter((item) => item !== id) : [id, ...current.liked],
      }));
      sync(liked ? 'DELETE' : 'PUT', `/favorites/${id}`);
    },
    [sync],
  );

  const reject = useCallback(
    (id) => {
      const wasLiked = feedbackRef.current.liked.includes(id);
      setFeedback((current) => ({
        ...current,
        liked: current.liked.filter((item) => item !== id),
        rejected: current.rejected.includes(id) ? current.rejected : [id, ...current.rejected],
      }));
      if (wasLiked) sync('DELETE', `/favorites/${id}`);
      sync('POST', '/history', { song_id: id, event: 'rejected' });
    },
    [sync],
  );

  const unreject = useCallback(
    (id) => {
      setFeedback((current) => ({ ...current, rejected: current.rejected.filter((item) => item !== id) }));
      sync('DELETE', `/history/rejections/${id}`);
    },
    [sync],
  );

  const restoreAllRejected = useCallback(() => {
    setFeedback((current) => ({ ...current, rejected: [] }));
    sync('DELETE', '/history/rejections');
  }, [sync]);

  const markShown = useCallback((ids) => {
    setFeedback((current) => ({
      ...current,
      recent: [...new Set([...ids, ...current.recent])].slice(0, MAX_RECENT),
    }));
  }, []);

  const markSkipped = useCallback(
    (id) => {
      setFeedback((current) => ({
        ...current,
        skipped: [id, ...current.skipped.filter((item) => item !== id)].slice(0, MAX_RECENT),
      }));
      sync('POST', '/history', { song_id: id, event: 'skipped' });
    },
    [sync],
  );

  const markPlayed = useCallback((id) => sync('POST', '/history', { song_id: id, event: 'played' }), [sync]);

  const value = useMemo(
    () => ({
      ...feedback,
      synced: !loggedIn || syncedFor === user?.id,
      toggleLike,
      reject,
      unreject,
      restoreAllRejected,
      markShown,
      markSkipped,
      markPlayed,
    }),
    [feedback, loggedIn, syncedFor, user, toggleLike, reject, unreject, restoreAllRejected, markShown, markSkipped, markPlayed],
  );

  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return context;
}
