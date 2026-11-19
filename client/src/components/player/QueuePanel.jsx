import { useEffect, useRef } from 'react';
import Artwork from '../ui/Artwork.jsx';
import PixelGlyph from '../ui/PixelGlyph.jsx';
import { ICONS } from './icons.js';
import { usePlayer, isPlayable } from '../../context/PlayerContext.jsx';
import { playOrder } from '../../lib/playerQueue.js';

function SmallButton({ icon, label, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="player-btn h-7 w-7 disabled:opacity-30">
      <PixelGlyph rows={ICONS[icon]} className="h-3 w-3" />
    </button>
  );
}

// The list of songs in the queue, in play order.
export default function QueuePanel({ onClose }) {
  const player = usePlayer();
  const entries = playOrder(player);
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label="Play queue"
      className="window fixed inset-x-2 bottom-[8.5rem] z-50 flex max-h-[min(60vh,32rem)] flex-col outline-none sm:inset-x-auto sm:right-6 sm:w-[26rem] md:bottom-[7.25rem]"
    >
      <div className="window-bar">
        <span className="pixel-label">queue.m3u · {entries.length}</span>
        <button type="button" onClick={onClose} className="pixel-label hover:text-frost" aria-label="Close queue">
          close ✕
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
        <button type="button" className={`btn-ghost px-3 py-1.5 ${player.shuffle ? 'border-orchid text-orchid' : ''}`} aria-pressed={player.shuffle} onClick={player.toggleShuffle}>
          Shuffle {player.shuffle ? 'on' : 'off'}
        </button>
        <button type="button" className={`btn-ghost px-3 py-1.5 ${player.repeat !== 'off' ? 'border-orchid text-orchid' : ''}`} onClick={player.cycleRepeat}>
          Repeat {player.repeat === 'one' ? 'one' : player.repeat}
        </button>
        {player.youtube.available && (
          <button
            type="button"
            className={`btn-ghost px-3 py-1.5 ${player.youtube.fullSongs ? 'border-orchid text-orchid' : ''}`}
            aria-pressed={player.youtube.fullSongs}
            onClick={() => player.setFullSongs(!player.youtube.fullSongs)}
          >
            Full songs {player.youtube.fullSongs ? 'on' : 'off'}
          </button>
        )}
        <button type="button" className="btn-ghost ml-auto px-3 py-1.5" onClick={player.clearQueue} disabled={entries.length === 0}>
          Clear
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="p-4 text-sm text-silver">The queue is empty. Use “Play” or “+ Queue” on any song.</p>
      ) : (
        <ol className="overflow-y-auto p-2">
          {entries.map(({ song, queueIndex, position }) => {
            const now = position === player.position;
            return (
              <li key={song.id} className={`flex items-center gap-2.5 rounded-md p-1.5 ${now ? 'bg-violet/25' : 'hover:bg-white/5'}`}>
                <button type="button" onClick={() => player.jumpTo(position)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-current={now ? 'true' : undefined}>
                  <Artwork song={song} className="w-9 shrink-0" />
                  <span className="min-w-0">
                    <span className={`block truncate text-sm ${now ? 'text-orchid' : 'text-frost'}`}>
                      {now && <span className="sr-only">Now playing: </span>}
                      {song.title}
                    </span>
                    <span className="block truncate text-xs text-silver">
                      {song.artist}
                      {!isPlayable(song) && ' · no preview'}
                    </span>
                  </span>
                </button>
                <SmallButton icon="up" label={`Move ${song.title} up`} onClick={() => player.moveInQueue(position, position - 1)} disabled={position === 0} />
                <SmallButton icon="down" label={`Move ${song.title} down`} onClick={() => player.moveInQueue(position, position + 1)} disabled={position === entries.length - 1} />
                <SmallButton icon="close" label={`Remove ${song.title} from queue`} onClick={() => player.removeFromQueue(queueIndex)} />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
