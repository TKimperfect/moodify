// Credits and links for songs from real music services: the song's page,
// and for Creative Commons songs the licence (required by the licence).
export default function SourceLinks({ song, className = '' }) {
  const links = song.playback?.links ?? [];
  const playable = song.playback?.status === 'preview';
  // For songs that cannot play, SongActions already shows the first link.
  const shown = playable ? links : links.slice(1);
  if (shown.length === 0) return null;
  return (
    <p className={`pixel-label flex flex-wrap gap-x-3 gap-y-1 text-silver ${className}`}>
      {shown.map((link) => (
        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4 hover:text-orchid">
          {link.label} ↗
        </a>
      ))}
    </p>
  );
}
