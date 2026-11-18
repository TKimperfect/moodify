import PixelGlyph from '../ui/PixelGlyph.jsx';
import { ICONS } from './icons.js';
import { usePlayer, isPlayable } from '../../context/PlayerContext.jsx';

// "Play" and "+ Queue" buttons for one song. "list" is the list the song
// belongs to, so playing it continues with the rest of that list.
export default function SongActions({ song, list, compact = false }) {
  const player = usePlayer();
  const isCurrent = player.current?.id === song.id;
  const playing = isCurrent && (player.status === 'playing' || player.status === 'loading');
  const inQueue = player.queue.some((item) => item.id === song.id);
  const playable = isPlayable(song);

  function onPlay() {
    if (isCurrent && playable) player.togglePlay();
    else player.playSong(song, list);
  }

  const link = !playable ? song.playback?.links?.[0] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={`icon-btn ${isCurrent ? 'icon-btn-on' : ''}`}
        onClick={onPlay}
        aria-label={`${playing ? 'Pause' : 'Play'}: ${song.title}`}
        aria-pressed={isCurrent}
      >
        <PixelGlyph rows={ICONS[playing ? 'pause' : 'play']} className="h-3 w-3" />
        {!compact && <span aria-hidden="true">{playing ? 'Pause' : isCurrent ? 'Resume' : 'Play'}</span>}
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => player.addToQueue(song)}
        disabled={inQueue}
        aria-label={inQueue ? `${song.title} is in the queue` : `Add ${song.title} to the queue`}
      >
        <PixelGlyph rows={ICONS.plus} className="h-3 w-3" />
        {!compact && <span aria-hidden="true">{inQueue ? 'Queued' : 'Queue'}</span>}
      </button>
      {link && (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="icon-btn">
          {link.label} ↗
        </a>
      )}
    </div>
  );
}
