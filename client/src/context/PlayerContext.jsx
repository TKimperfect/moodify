import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { queueReducer, restoreQueue, currentSong, EMPTY_QUEUE } from '../lib/playerQueue.js';
import { readJson, writeJson } from '../lib/storage.js';
import { resolveApiUrl } from '../lib/api.js';
import { useFeedback } from './FeedbackContext.jsx';

// The music player. It lives above every page (in main.jsx), so the music
// keeps playing while the user moves around the site.
//
// One <audio> element plays everything. Only songs whose playback status is
// "preview" have an audio address; other songs show what is possible instead
// (for example "listen on Spotify").
const QUEUE_KEY = 'moodify.queue.v1'; // this tab only
const SETTINGS_KEY = 'moodify.player.v1'; // remembered

const PlayerContext = createContext(null);

export const isPlayable = (song) => song?.playback?.status === 'preview' && Boolean(song.playback.audio_url);

function loadSettings() {
  const stored = readJson(SETTINGS_KEY);
  const volume = Number(stored?.volume);
  return { volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8, muted: stored?.muted === true };
}

export function PlayerProvider({ children }) {
  const [queueState, dispatch] = useReducer(queueReducer, undefined, () => restoreQueue(readJson(QUEUE_KEY, 'session')));
  const [settings, setSettings] = useState(loadSettings);
  const [status, setStatus] = useState('idle'); // idle | loading | playing | paused | unavailable | error
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [playRequest, setPlayRequest] = useState(0); // goes up whenever the user asks to play
  const { markSkipped, markPlayed } = useFeedback();
  const playedLogged = useRef(null);

  const audioRef = useRef(null);
  const current = currentSong(queueState);
  const latest = useRef({ queueState, current, status, time });
  latest.current = { ...latest.current, queueState, current, status, time, onPlayed: markPlayed };

  // Remember the queue for this tab and the volume for next time.
  useEffect(() => {
    writeJson(QUEUE_KEY, { ...queueState, ended: false }, 'session');
  }, [queueState]);
  useEffect(() => {
    writeJson(SETTINGS_KEY, settings);
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
      audioRef.current.muted = settings.muted;
    }
  }, [settings]);

  // Create the audio element once and listen to what it does.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = settings.volume;
    audio.muted = settings.muted;
    audioRef.current = audio;

    const update = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      setTime({ current: audio.currentTime || 0, duration });
      // Counts as "played" after 30 seconds, or half the song if it is shorter.
      const song = latest.current.current;
      if (song && !song.external && duration > 0 && playedLogged.current !== song.id && audio.currentTime >= Math.min(30, duration / 2)) {
        playedLogged.current = song.id;
        latest.current.onPlayed?.(song.id);
      }
    };
    const onPlay = () => setStatus('playing');
    const onPause = () => setStatus((value) => (value === 'unavailable' || value === 'error' ? value : 'paused'));
    const onWaiting = () => setStatus('loading');
    const onError = () => {
      if (audio.getAttribute('src')) setStatus('error');
    };
    const onEnded = () => {
      const { queueState: state } = latest.current;
      if (state.repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      dispatch({ type: 'NEXT', auto: true });
      setPlayRequest((value) => value + 1);
    };

    audio.addEventListener('timeupdate', update);
    audio.addEventListener('durationchange', update);
    audio.addEventListener('loadedmetadata', update);
    audio.addEventListener('playing', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load (and, if asked, play) the current song.
  const autoSkips = useRef(0);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (queueState.ended) {
      audio.pause();
      audio.currentTime = 0;
      setStatus('paused');
      return;
    }
    if (!current) {
      audio.pause();
      audio.removeAttribute('src');
      setStatus('idle');
      setTime({ current: 0, duration: 0 });
      return;
    }
    if (!isPlayable(current)) {
      audio.pause();
      audio.removeAttribute('src');
      setTime({ current: 0, duration: 0 });
      setStatus('unavailable');
      // When the queue moved on by itself, skip songs that cannot play.
      if (playRequest > 0 && latest.current.autoAdvance && autoSkips.current < queueState.queue.length) {
        autoSkips.current += 1;
        dispatch({ type: 'NEXT', auto: true });
        setPlayRequest((value) => value + 1);
      }
      return;
    }
    autoSkips.current = 0;
    const url = resolveApiUrl(current.playback.audio_url);
    if (audio.dataset.songId !== current.id) {
      audio.dataset.songId = current.id;
      playedLogged.current = null;
      audio.src = url;
      setTime({ current: 0, duration: current.playback.duration_s ?? 0 });
    }
    if (playRequest === 0) {
      setStatus('paused'); // restored from a previous visit: wait for the user
      return;
    }
    setStatus('loading');
    audio.play().catch((error) => {
      // Browsers block sound until the user has clicked something.
      setStatus(error.name === 'NotAllowedError' ? 'paused' : 'error');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, playRequest, queueState.ended]);

  // ---- Controls ------------------------------------------------------------
  const request = useCallback((auto = false) => {
    latest.current.autoAdvance = auto;
    setPlayRequest((value) => value + 1);
  }, []);

  const playList = useCallback(
    (songs, startIndex = 0) => {
      dispatch({ type: 'PLAY_LIST', songs, startIndex });
      request();
    },
    [request],
  );

  const playSong = useCallback(
    (song, list) => {
      const songs = list?.length ? list : [song];
      playList(songs, Math.max(0, songs.findIndex((item) => item.id === song.id)));
    },
    [playList],
  );

  const addToQueue = useCallback((song) => dispatch({ type: 'ADD', song }), []);
  const playNext = useCallback((song) => dispatch({ type: 'PLAY_NEXT', song }), []);
  const removeFromQueue = useCallback((queueIndex) => dispatch({ type: 'REMOVE', queueIndex }), []);
  const moveInQueue = useCallback((from, to) => dispatch({ type: 'MOVE', from, to }), []);
  const clearQueue = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  const toggleShuffle = useCallback(() => dispatch({ type: 'TOGGLE_SHUFFLE' }), []);
  const cycleRepeat = useCallback(() => dispatch({ type: 'CYCLE_REPEAT' }), []);

  const jumpTo = useCallback(
    (position) => {
      dispatch({ type: 'JUMP', position });
      request();
    },
    [request],
  );

  const next = useCallback(() => {
    const { current: song, status: state, time: t } = latest.current;
    // Leaving a catalogue song in its first half counts as a skip.
    if (song && !song.external && state === 'playing' && t.duration > 0 && t.current < t.duration / 2) markSkipped(song.id);
    dispatch({ type: 'NEXT' });
    request();
  }, [markSkipped, request]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    // Like most players: "previous" first restarts a song that is under way.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    dispatch({ type: 'PREVIOUS' });
    request();
  }, [request]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const { current: song, queueState: state } = latest.current;
    if (!audio || !song || !isPlayable(song)) return;
    if (state.ended) {
      dispatch({ type: 'JUMP', position: state.position });
      request();
      return;
    }
    if (audio.paused) {
      if (!audio.getAttribute('src')) {
        request();
        return;
      }
      audio.play().catch((error) => setStatus(error.name === 'NotAllowedError' ? 'paused' : 'error'));
    } else {
      audio.pause();
    }
  }, [request]);

  const seek = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio || !audio.getAttribute('src')) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    setTime((value) => ({ ...value, current: audio.currentTime }));
  }, []);

  const setVolume = useCallback((volume) => setSettings({ volume: Math.min(1, Math.max(0, volume)), muted: volume === 0 }), []);
  const toggleMute = useCallback(() => setSettings((value) => ({ ...value, muted: !value.muted, volume: value.volume || 0.5 })), []);

  // Hardware media keys and the phone lock screen (where supported).
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: 'MOODIFY',
        artwork: current.artwork_url ? [{ src: current.artwork_url, sizes: '300x300' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('nexttrack', next);
      navigator.mediaSession.setActionHandler('previoustrack', previous);
    } catch {
      // Not supported in this browser: nothing to do.
    }
  }, [current, togglePlay, next, previous]);

  const value = useMemo(
    () => ({
      ...queueState,
      current,
      status,
      currentTime: time.current,
      duration: time.duration,
      volume: settings.volume,
      muted: settings.muted,
      playSong,
      playList,
      addToQueue,
      playNext,
      removeFromQueue,
      moveInQueue,
      clearQueue,
      jumpTo,
      next,
      previous,
      togglePlay,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
    }),
    [queueState, current, status, time, settings, playSong, playList, addToQueue, playNext, removeFromQueue, moveInQueue, clearQueue, jumpTo, next, previous, togglePlay, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return context;
}

export { EMPTY_QUEUE };
