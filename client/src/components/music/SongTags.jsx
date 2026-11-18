import { GENRES } from '../../data/spectrum.js';

const genreLabel = (id) => GENRES.find((genre) => genre.id === id)?.label ?? id;

// Genre and mood labels for a song.
export default function SongTags({ song, className = '' }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Genres and moods">
      {song.genres.map((genre) => (
        <li key={genre} className="tag">
          {genreLabel(genre)}
        </li>
      ))}
      {song.moods.map((mood) => (
        <li key={mood} className="tag tag-mood">
          {mood}
        </li>
      ))}
    </ul>
  );
}
