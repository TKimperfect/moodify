import PixelGlyph from './PixelGlyph.jsx';
import { MOODS } from '../../data/moods.js';
import { artFor } from '../../lib/art.js';

// Cover art. Real cover images (e.g. from Spotify) are shown when available;
// otherwise a generated gradient + pixel icon stands in.
export default function Artwork({ song, art = song ? artFor({ ...song, moods: song.moods?.length ? song.moods : ['calm'] }) : null, className = '' }) {
  if (song?.artwork_url) {
    return (
      <img
        src={song.artwork_url}
        alt=""
        loading="lazy"
        className={`aspect-square rounded-md border border-white/10 object-cover ${className}`}
      />
    );
  }
  const glyph = MOODS.find((mood) => mood.id === art.glyph)?.glyph;
  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-md border border-white/10 ${className}`}
      style={{ background: `linear-gradient(${art.angle}deg, ${art.from}, ${art.to})` }}
      aria-hidden="true"
    >
      {/* scan lines */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.16)_0_1px,transparent_1px_4px)]" />
      {/* glossy highlight */}
      <div className="absolute -top-1/2 left-0 h-full w-full rounded-[50%] bg-white/15 blur-xl" />
      {glyph && <PixelGlyph rows={glyph} className="absolute bottom-[10%] right-[10%] h-[32%] w-[32%] text-white/85" />}
    </div>
  );
}
