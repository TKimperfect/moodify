import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { queueReducer, restoreQueue, currentSong, EMPTY_QUEUE } from '../lib/playerQueue.js';
import { readJson, writeJson } from '../lib/storage.js';
import { apiGet, resolveApiUrl } from '../lib/api.js';
import { useFeedback } from './FeedbackContext.jsx';

// The music player. It lives above every page (in main.jsx), so the music
// keeps playing while the user moves around the site.
//
// Two "engines" play the songs:
//   audio   - one <audio> element: sample clips, Jamendo songs, 30s previews
//   youtube - YouTube's own embedded player, for full songs (when the server
//             has YouTube switched on and "Full songs" is on). If YouTube
//             cannot play a song, the player falls back to its preview.
// Every control (play, pause, seek, volume, next...) works with both.
const QUEUE_KEY = 'moodify.queue.v1'; // this tab only
const SETTINGS_KEY = 'moodify.player.v1'; // remembered

const PlayerContext = createContext(null);

export const isPlayable = (song) => song?.playback?.status === 'preview' && Boolean(song.playback.audio_url);

function loadSettings() {
  const stored = readJson(SETTINGS_KEY);
  const volume = Number(stored?.volume);
  return {
    volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8,
    muted: stored?.muted === true,
    fullSongs: stored?.fullSongs !== false,
  };
}

const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

export function PlayerProvider({ children }) {
  const [queueState, dispatch] = useReducer(queueReducer, undefined, () => restoreQueue(readJson(QUEUE_KEY, 'session')));
  const [settings, setSettings] = useState(loadSettings);
  const [status, setStatus] = useState('idle'); // idle | loading | playing | paused | unavailable | error
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [playRequest, setPlayRequest] = useState(0); // goes up whenever the user asks to play
  const [youtubeAvailable, setYoutubeAvailable] = useState(false);
  const [yt, setYt] = useState({ songId: null, status: 'idle', videoId: null, message: null });
  const { markSkipped, markPlayed } = useFeedback();
  const playedLogged = useRef(null);
  const ytPlayer = useRef(null);
  const wantPlay = useRef(false);

  const audioRef = useRef(null);
  const current = currentSong(queueState);
  const ytFailed = yt.songId === current?.id && yt.status === 'failed';
  const engine = current && youtubeAvailable && settings.fullSongs && current.playback?.youtube && !ytFailed ? 'youtube' : 'audio';

  const latest = useRef({});
  latest.current = { ...latest.current, queueState, current, status, time, engine, settings, onPlayed: markPlayed };

  // Is "full songs on YouTube" switched on for this server?
  useEffect(() => {
    apiGet('/music/providers')
      .then((data) => setYoutubeAvailable(Boolean(data.providers?.youtube?.full_songs)))
      .catch(() => setYoutubeAvailable(false));
  }, []);

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
    const player = ytPlayer.current;
    if (player?.setVolume) {
      player.setVolume(Math.round(settings.volume * 100));
      if (settings.muted) player.mute();
      else player.unMute();
    }
  }, [settings]);

  // Shared by both engines: progress, "played" history, end of a song.
  const progress = useCallback((currentTime, duration) => {
    setTime({ current: currentTime, duration });
    // Counts as "played" after 30 seconds, or half the song if it is shorter.
    const song = latest.current.current;
    if (song && !song.external && duration > 0 && playedLogged.current !== song.id && currentTime >= Math.min(30, duration / 2)) {
      playedLogged.current = song.id;
      latest.current.onPlayed?.(song.id);
    }
  }, []);

  const songEnded = useCallback((restart) => {
    if (latest.current.queueState.repeat === 'one') {
      restart();
      return;
    }
    latest.current.autoAdvance = true;
    dispatch({ type: 'NEXT', auto: true });
    setPlayRequest((value) => value + 1);
  }, []);

  // ---- Audio engine --------------------------------------------------------
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = settings.volume;
    audio.muted = settings.muted;
    audioRef.current = audio;

    const update = () => progress(audio.currentTime || 0, Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setStatus('playing');
    const onPause = () => setStatus((value) => (value === 'unavailable' || value === 'error' ? value : 'paused'));
    const onWaiting = () => setStatus('loading');
    const onError = () => {
      if (audio.getAttribute('src')) setStatus('error');
    };
    const onEnded = () =>
      songEnded(() => {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      });

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

  const stopAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    delete audio.dataset.songId;
  };

  // ---- Load (and, if asked, play) the current song --------------------------
  const autoSkips = useRef(0);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (queueState.ended) {
      audio.pause();
      ytPlayer.current?.pauseVideo?.();
      setStatus('paused');
      return;
    }
    if (!current) {
      stopAudio();
      setStatus('idle');
      setTime({ current: 0, duration: 0 });
      return;
    }

    if (engine === 'youtube') {
      stopAudio();
      wantPlay.current = playRequest > 0;
      if (yt.songId !== current.id) {
        playedLogged.current = null;
        setTime({ current: 0, duration: current.playback.duration_s ?? 0 });
        setYt({ songId: current.id, status: 'finding', videoId: null, message: null });
        setStatus(wantPlay.current ? 'loading' : 'paused');
        const params = current.external ? { title: current.title, artist: current.artist } : { song_id: current.id };
        const songId = current.id;
        apiGet('/music/youtube', { params })
          .then((result) => setYt((value) => (value.songId === songId ? { ...value, status: 'ready', videoId: result.video_id } : value)))
          .catch((error) =>
            setYt((value) => (value.songId === songId ? { ...value, status: 'failed', message: `${error.message}. Playing the preview instead` } : value)),
          );
      } else if (yt.status === 'ready' && wantPlay.current) {
        ytPlayer.current?.playVideo?.();
      }
      return;
    }

    // Audio engine.
    if (!isPlayable(current)) {
      stopAudio();
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
    if (audio.dataset.songId !== current.id) {
      audio.dataset.songId = current.id;
      playedLogged.current = null;
      audio.src = resolveApiUrl(current.playback.audio_url);
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
  }, [current?.id, playRequest, queueState.ended, engine]);

  // ---- YouTube engine: called by the YouTube window -------------------------
  const youtubeEvents = useMemo(
    () => ({
      ready(player) {
        ytPlayer.current = player;
        const { settings: s } = latest.current;
        player.setVolume(Math.round(s.volume * 100));
        if (s.muted) player.mute();
        if (wantPlay.current) player.playVideo();
      },
      state(code, player) {
        if (code === YT_STATE.PLAYING) setStatus('playing');
        else if (code === YT_STATE.PAUSED || code === YT_STATE.CUED) setStatus('paused');
        else if (code === YT_STATE.BUFFERING) setStatus('loading');
        else if (code === YT_STATE.ENDED) {
          songEnded(() => {
            player.seekTo(0, true);
            player.playVideo();
          });
        }
      },
      error(message) {
        const songId = latest.current.current?.id;
        ytPlayer.current = null;
        setYt((value) => (value.songId === songId ? { ...value, status: 'failed', message: `${message}. Playing the preview instead` } : value));
      },
      gone() {
        ytPlayer.current = null;
      },
    }),
    [songEnded],
  );

  // Progress for YouTube (its player has no events for time).
  useEffect(() => {
    if (engine !== 'youtube' || yt.status !== 'ready') return undefined;
    const timer = setInterval(() => {
      const player = ytPlayer.current;
      if (player?.getCurrentTime) progress(player.getCurrentTime() || 0, player.getDuration() || 0);
    }, 500);
    return () => clearInterval(timer);
  }, [engine, yt.status, progress]);

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

  const seek = useCallback((seconds) => {
    if (latest.current.engine === 'youtube') {
      ytPlayer.current?.seekTo?.(Math.max(0, seconds), true);
      setTime((value) => ({ ...value, current: seconds }));
      return;
    }
    const audio = audioRef.current;
    if (!audio || !audio.getAttribute('src')) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    setTime((value) => ({ ...value, current: audio.currentTime }));
  }, []);

  const previous = useCallback(() => {
    // Like most players: "previous" first restarts a song that is under way.
    if (latest.current.time.current > 3) {
      seek(0);
      return;
    }
    dispatch({ type: 'PREVIOUS' });
    request();
  }, [request, seek]);

  const togglePlay = useCallback(() => {
    const { current: song, queueState: state, engine: activeEngine } = latest.current;
    if (!song) return;
    if (state.ended) {
      dispatch({ type: 'JUMP', position: state.position });
      request();
      return;
    }
    if (activeEngine === 'youtube') {
      const player = ytPlayer.current;
      if (!player?.getPlayerState) {
        request();
        return;
      }
      if (player.getPlayerState() === YT_STATE.PLAYING) player.pauseVideo();
      else player.playVideo();
      return;
    }
    const audio = audioRef.current;
    if (!audio || !isPlayable(song)) return;
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

  const setVolume = useCallback((volume) => setSettings((value) => ({ ...value, volume: Math.min(1, Math.max(0, volume)), muted: volume === 0 })), []);
  const toggleMute = useCallback(() => setSettings((value) => ({ ...value, muted: !value.muted, volume: value.volume || 0.5 })), []);

  // Full songs (YouTube) on or off. Keeps playing if music was playing.
  const setFullSongs = useCallback(
    (on) => {
      const wasPlaying = latest.current.status === 'playing' || latest.current.status === 'loading';
      ytPlayer.current?.pauseVideo?.();
      setSettings((value) => ({ ...value, fullSongs: on }));
      if (!on) setYt({ songId: null, status: 'idle', videoId: null, message: null });
      if (wasPlaying) request();
    },
    [request],
  );

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
      engine,
      youtube: {
        available: youtubeAvailable,
        fullSongs: settings.fullSongs,
        status: yt.songId === current?.id ? yt.status : 'idle',
        videoId: yt.songId === current?.id ? yt.videoId : null,
        message: yt.songId === current?.id ? yt.message : null,
        events: youtubeEvents,
        wantPlay,
      },
      setFullSongs,
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
    [queueState, current, status, time, settings, engine, youtubeAvailable, yt, youtubeEvents, setFullSongs, playSong, playList, addToQueue, playNext, removeFromQueue, moveInQueue, clearQueue, jumpTo, next, previous, togglePlay, seek, setVolume, toggleMute, toggleShuffle, cycleRepeat],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return context;
}

export { EMPTY_QUEUE };
