import PixelGlyph from '../ui/PixelGlyph.jsx';
import { useFeedback } from '../../context/FeedbackContext.jsx';

const HEART = ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'];

// Heart button that marks a song as a favourite.
export default function LikeButton({ song, showLabel = false }) {
  const { liked, toggleLike } = useFeedback();
  const isLiked = liked.includes(song.id);
  // Songs from outside the catalogue (e.g. Spotify search) cannot be saved yet.
  if (song.external) return null;
  return (
    <button
      type="button"
      className={`icon-btn ${isLiked ? 'icon-btn-on' : ''}`}
      aria-pressed={isLiked}
      aria-label={`${isLiked ? 'Remove from favourites' : 'Add to favourites'}: ${song.title}`}
      onClick={() => toggleLike(song.id)}
    >
      <PixelGlyph rows={HEART} className="h-3.5 w-3.5" />
      {showLabel && <span aria-hidden="true">{isLiked ? 'Liked' : 'Like'}</span>}
    </button>
  );
}
