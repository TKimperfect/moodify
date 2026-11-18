import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  DEFAULT_DRAFT,
  buildProfile,
  draftFromProfile,
  missingSteps,
  sanitizeProfile,
  suggestSpectrum,
} from '../lib/moodProfile.js';
import { readJson, writeJson, removeKey } from '../lib/storage.js';
import { useAuth } from './AuthContext.jsx';

// Shared "memory" for the mood profile. Any page can read it, so the
// selection is not lost when the user moves between pages.
const STORAGE_KEY = 'moodify.profile.v1';
const MoodProfileContext = createContext(null);

function loadSaved() {
  const stored = readJson(STORAGE_KEY);
  const profile = sanitizeProfile(stored?.profile);
  if (!profile) return null;
  return { profile, savedAt: typeof stored.savedAt === 'string' ? stored.savedAt : null };
}

export function MoodProfileProvider({ children }) {
  const [saved, setSaved] = useState(loadSaved);
  const { status, authFetch } = useAuth();

  // Logged-in users: keep a history of the mood profiles they locked in.
  const recordSession = useCallback(
    (profile, source) => {
      if (status !== 'user') return;
      authFetch('POST', '/mood-sessions', { body: { profile, source } }).catch((error) =>
        console.warn('Could not save this mood to your history:', error.message),
      );
    },
    [status, authFetch],
  );
  // Start from the saved profile if there is one, otherwise from a blank draft.
  const [draft, setDraft] = useState(() => (saved ? draftFromProfile(saved.profile) : DEFAULT_DRAFT));

  // Changing moods also moves the sliders to a suggested position,
  // but only while the user has not moved them personally.
  const setMoods = useCallback((moods) => {
    setDraft((current) => ({
      ...current,
      moods,
      ...(current.spectrumTouched ? {} : suggestSpectrum(moods)),
    }));
  }, []);

  const setSpectrum = useCallback((key, value) => {
    setDraft((current) => ({ ...current, [key]: value, spectrumTouched: true }));
  }, []);

  const useSuggestedSpectrum = useCallback(() => {
    setDraft((current) => ({ ...current, ...suggestSpectrum(current.moods), spectrumTouched: false }));
  }, []);

  const setField = useCallback((key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const toggleGenre = useCallback((id) => {
    setDraft((current) => ({
      ...current,
      genres: current.genres.includes(id) ? current.genres.filter((item) => item !== id) : [...current.genres, id],
    }));
  }, []);

  const resetDraft = useCallback(() => setDraft(DEFAULT_DRAFT), []);

  // Stores the finished profile in the browser. Returns false if incomplete.
  const saveProfile = useCallback(() => {
    const profile = buildProfile(draft);
    if (!profile) return false;
    const record = { profile, savedAt: new Date().toISOString() };
    writeJson(STORAGE_KEY, record);
    setSaved(record);
    recordSession(profile, 'manual');
    return true;
  }, [draft, recordSession]);

  // Saves a finished profile that came from somewhere else (the assistant).
  // "source" is where it came from: 'assistant' (saved to the history) or
  // 'history' (re-using an old one, so not saved again).
  const applyProfile = useCallback(
    (input, source = 'assistant') => {
      const profile = sanitizeProfile(input);
      if (!profile) return false;
      const record = { profile, savedAt: new Date().toISOString() };
      writeJson(STORAGE_KEY, record);
      setSaved(record);
      setDraft(draftFromProfile(profile));
      if (source !== 'history') recordSession(profile, source);
      return true;
    },
    [recordSession],
  );

  // Loads a profile into the homepage controls without saving it.
  const loadIntoEditor = useCallback((input) => {
    const profile = sanitizeProfile(input);
    if (profile) setDraft(draftFromProfile(profile));
  }, []);

  const clearSaved = useCallback(() => {
    removeKey(STORAGE_KEY);
    setSaved(null);
    setDraft(DEFAULT_DRAFT);
  }, []);

  const value = useMemo(
    () => ({
      draft,
      profile: buildProfile(draft),
      missing: missingSteps(draft),
      saved,
      setMoods,
      setSpectrum,
      useSuggestedSpectrum,
      setField,
      toggleGenre,
      resetDraft,
      saveProfile,
      applyProfile,
      loadIntoEditor,
      clearSaved,
    }),
    [draft, saved, setMoods, setSpectrum, useSuggestedSpectrum, setField, toggleGenre, resetDraft, saveProfile, applyProfile, loadIntoEditor, clearSaved],
  );

  return <MoodProfileContext.Provider value={value}>{children}</MoodProfileContext.Provider>;
}

export function useMoodProfile() {
  const context = useContext(MoodProfileContext);
  if (!context) throw new Error('useMoodProfile must be used inside <MoodProfileProvider>');
  return context;
}
