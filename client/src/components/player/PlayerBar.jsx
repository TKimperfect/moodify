import { useEffect, useRef, useState } from 'react';
import Artwork from '../ui/Artwork.jsx';
import PixelGlyph from '../ui/PixelGlyph.jsx';
import QueuePanel from './QueuePanel.jsx';
import YouTubeWindow from './YouTubeWindow.jsx';
import { ICONS } from './icons.js';
import { usePlayer, isPlayable } from '../../context/PlayerContext.jsx';

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function ControlButton({ icon, label, onClick, active = false, large = false, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active === null ? undefined : active}
      className={`player-btn ${large ? 'player-btn-main' : ''} ${active ? 'player-btn-on' : ''} ${className}`}
    >
      <PixelGlyph rows={ICONS[icon]} className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
    </button>
  );
}

const STATUS_TEXT = {
  loading: 'Loading…',
  error: "This audio couldn't be loaded",
};

// The persistent player at the bottom of every page.
export default function PlayerBar() {
  const player = usePlayer();
  const [queueOpen, setQueueOpen] = useState(false);
  const song = player.current;

  // The YouTube video can be hidden. YouTube's rules do not allow a song to
  // play while its player is hidden, so hiding pauses the song, and playing
  // (here or anywhere else) shows the video again.
  const [videoHidden, setVideoHidden] = useState(false);
  const resumeOnShow = useRef(false);
  const busy = player.status === 'playing' || player.status === 'loading';
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (videoHidden && busy && !wasBusy.current) setVideoHidden(false);
    wasBusy.current = busy;
  }, [busy, videoHidden]);
  const hideVideo = () => {
    resumeOnShow.current = busy;
    if (busy) player.togglePlay();
    setVideoHidden(true);
  };
  const showVideo = () => {
    setVideoHidden(false);
    if (resumeOnShow.current && !busy) player.togglePlay();
    resumeOnShow.current = false;
  };

  if (!song && player.queue.length === 0) return null;

  const onYouTube = player.engine === 'youtube';
  const playable = isPlayable(song) || onYouTube;
  const playing = player.status === 'playing' || player.status === 'loading';
  const duration = player.duration || song?.playback?.duration_s || 0;
  const repeatLabel = { off: 'Repeat: off', all: 'Repeat: all', one: 'Repeat: this song' }[player.repeat];
  let statusText = STATUS_TEXT[player.status] ?? song?.playback?.label ?? '';
  if (onYouTube && player.status !== 'loading') statusText = 'Full song · YouTube';
  if (player.youtube.message) statusText = player.youtube.message;

  return (
    <>
      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}
      {onYouTube && song && <YouTubeWindow hidden={videoHidden} onHide={hideVideo} />}
      <section className="player-bar fixed inset-x-0 bottom-0 z-40" aria-label="Music player">
        {/* Progress bar (full width, on top) */}
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-2 sm:px-6">
          <span className="pixel-label w-9 text-right tabular-nums text-silver">{formatTime(player.currentTime)}</span>
          <input
            type="range"
            min="0"
            max={Math.max(1, duration)}
            step="0.1"
            value={Math.min(player.currentTime, duration || 0)}
            onChange={(event) => player.seek(Number(event.target.value))}
            disabled={!playable}
            aria-label="Song position"
            aria-valuetext={`${formatTime(player.currentTime)} of ${formatTime(duration)}`}
            className="player-range flex-1"
            style={{ '--fill': `${duration ? (player.currentTime / duration) * 100 : 0}%` }}
          />
          <span className="pixel-label w-9 tabular-nums text-silver">{formatTime(duration)}</span>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pb-3 pt-1.5 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          {/* Now playing */}
          <div className="flex min-w-0 items-center gap-3">
            {song && <Artwork song={song} className="w-11 shrink-0 sm:w-12" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-frost">{song?.title ?? 'Queue finished'}</p>
              <p className="truncate text-xs text-silver">{song?.artist}</p>
              <p className="pixel-label mt-0.5 truncate text-rose" aria-live="polite">
                {statusText}
                {!onYouTube && song?.playback?.links?.[0] && (song.playback.source === 'jamendo' || !playable) && (
                  <>
                    {' · '}
                    <a href={song.playback.links[0].url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-frost">
                      {song.playback.links[0].label}
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Main controls */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <ControlButton icon="shuffle" label={player.shuffle ? 'Shuffle: on' : 'Shuffle: off'} active={player.shuffle} onClick={player.toggleShuffle} className="hidden sm:inline-flex" />
            <ControlButton icon="previous" label="Previous" active={null} onClick={player.previous} />
            <ControlButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} active={null} large onClick={player.togglePlay} disabled={!playable} />
            <ControlButton icon="next" label="Next" active={null} onClick={player.next} />
            <span className="relative hidden sm:inline-flex">
              <ControlButton icon="repeat" label={repeatLabel} active={player.repeat !== 'off'} onClick={player.cycleRepeat} />
              {player.repeat === 'one' && <span className="pointer-events-none absolute -right-0.5 -top-0.5 text-[0.6rem] font-bold text-orchid">1</span>}
            </span>
            {onYouTube && (
              <ControlButton
                icon="video"
                label={videoHidden ? 'Show the YouTube video (and play on)' : 'Hide the YouTube video (pauses the song)'}
                active={!videoHidden}
                onClick={videoHidden ? showVideo : hideVideo}
              />
            )}
            <ControlButton icon="queue" label={queueOpen ? 'Hide queue' : `Show queue (${player.queue.length})`} active={queueOpen} onClick={() => setQueueOpen((value) => !value)} className="md:hidden" />
          </div>

          {/* Volume + queue (wide screens) */}
          <div className="hidden items-center justify-end gap-2 md:flex">
            {player.youtube.available && (
              <button
                type="button"
                className={`pixel-label rounded-md border px-2 py-1.5 ${player.youtube.fullSongs ? 'border-orchid text-orchid' : 'border-line text-silver hover:text-frost'}`}
                aria-pressed={player.youtube.fullSongs}
                onClick={() => player.setFullSongs(!player.youtube.fullSongs)}
                title="Play whole songs through YouTube when available"
              >
                Full songs
              </button>
            )}
            <ControlButton icon={player.muted || player.volume === 0 ? 'muted' : 'volume'} label={player.muted ? 'Unmute' : 'Mute'} active={null} onClick={player.toggleMute} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={player.muted ? 0 : player.volume}
              onChange={(event) => player.setVolume(Number(event.target.value))}
              aria-label="Volume"
              aria-valuetext={`${Math.round((player.muted ? 0 : player.volume) * 100)}%`}
              className="player-range w-24"
              style={{ '--fill': `${(player.muted ? 0 : player.volume) * 100}%` }}
            />
            <ControlButton icon="queue" label={queueOpen ? 'Hide queue' : `Show queue (${player.queue.length})`} active={queueOpen} onClick={() => setQueueOpen((value) => !value)} />
          </div>
        </div>
      </section>
    </>
  );
}
