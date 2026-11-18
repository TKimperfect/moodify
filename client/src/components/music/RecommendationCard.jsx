import Artwork from '../ui/Artwork.jsx';
import SongTags from './SongTags.jsx';
import LikeButton from './LikeButton.jsx';
import SongActions from '../player/SongActions.jsx';
import SourceLinks from './SourceLinks.jsx';
import AddToPlaylist from '../account/AddToPlaylist.jsx';
import { usePlayer } from '../../context/PlayerContext.jsx';

const PARTS = [
  ['mood', 'Mood', 30],
  ['effect', 'What you want', 25],
  ['genre', 'Genre', 20],
  ['tempo_energy', 'Tempo & energy', 15],
  ['history', 'Your history', 10],
];

// One recommended song: artwork, tags, the reasons it was chosen,
// the score details, and the like / "not for me" buttons.
export default function RecommendationCard({ item, rank, onReject, list }) {
  const { song, match, reasons, breakdown } = item;
  const { current } = usePlayer();
  const nowPlaying = current?.id === song.id;
  return (
    <li className={`window p-3.5 sm:p-4 ${nowPlaying ? 'border-orchid' : ''}`}>
      <div className="flex gap-4">
        <Artwork song={song} className="w-20 shrink-0 self-start sm:w-28" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {(rank || nowPlaying) && (
                <p className="pixel-label text-silver">
                  {rank && `No. ${String(rank).padStart(2, '0')}`}
                  {nowPlaying && <span className="text-orchid">{rank ? ' · ' : ''}now playing</span>}
                </p>
              )}
              <h3 className="mt-1 truncate text-lg font-medium text-frost">{song.title}</h3>
              <p className="truncate text-sm text-silver">{song.artist}</p>
            </div>
            <p className="shrink-0 text-right">
              <span className="chrome-text font-display text-2xl">{match}</span>
              <span className="pixel-label block text-silver">% match</span>
            </p>
          </div>
          <SongTags song={song} className="mt-3" />
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3.5">
        <p className="pixel-label text-rose">Why this song</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-snug text-chrome">
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-2.5">
              <span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 bg-orchid" aria-hidden="true" />
              {reason}
            </li>
          ))}
        </ul>

        <details className="group mt-3">
          <summary className="pixel-label cursor-pointer text-silver hover:text-orchid">Score details</summary>
          <dl className="mt-3 space-y-2">
            {PARTS.map(([key, label, weight]) => (
              <div key={key} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-xs text-silver">
                <dt>
                  {label} <span className="text-silver/70">· {weight}%</span>
                </dt>
                <dd className="h-1.5 overflow-hidden rounded-full border border-line bg-ink" aria-hidden="true">
                  <span className="block h-full bg-gradient-to-r from-violet to-orchid" style={{ width: `${breakdown[key]}%` }} />
                </dd>
                <dd className="text-right tabular-nums text-chrome">{breakdown[key]}</dd>
              </div>
            ))}
          </dl>
        </details>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SongActions song={song} list={list} />
          <LikeButton song={song} showLabel />
          <AddToPlaylist song={song} />
          {onReject && (
            <button type="button" className="icon-btn" onClick={() => onReject(song)} aria-label={`Not for me: ${song.title}`}>
              <span aria-hidden="true">✕ Not for me</span>
            </button>
          )}
          {song.playback?.label && <span className="pixel-label ml-auto text-silver">{song.playback.label}</span>}
        </div>
        <SourceLinks song={song} className="mt-3" />
      </div>
    </li>
  );
}
