import Artwork from '../ui/Artwork.jsx';
import SongTile from '../music/SongTile.jsx';
import { FEATURED_TRACKS } from '../../data/featured.js';
import { apiGet } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';

// Featured songs on the homepage. They come from the backend catalogue;
// if the backend cannot be reached, a built-in list is shown instead so
// the homepage never looks broken.
export default function FeaturedTracks() {
  const { status, data } = useApi((signal) => apiGet('/songs/discover', { signal }), []);
  const offline = status === 'error';

  return (
    <section aria-labelledby="featured-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="pixel-label text-rose">Featured // {offline ? 'offline copy' : 'sample catalogue'}</p>
          <h2 id="featured-heading" className="mt-2 font-display text-xl tracking-wider text-frost sm:text-2xl">
            Songs that get it
          </h2>
        </div>
        <p className="max-w-xs text-sm text-silver sm:text-right">
          Invented songs for development, each with its own original generated audio.
        </p>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={status === 'loading'}>
        {status === 'ok' &&
          data.featured.map(({ song, tagline }) => (
            <SongTile key={song.id} song={song} note={tagline} list={data.featured.map((item) => item.song)} />
          ))}

        {offline &&
          FEATURED_TRACKS.map((track) => (
            <li key={track.id} className="window flex gap-3.5 p-3">
              <Artwork art={track.art} className="w-20 shrink-0 self-start sm:w-24" />
              <div className="min-w-0 flex-1 py-0.5">
                <h3 className="truncate font-medium text-frost">{track.title}</h3>
                <p className="truncate text-sm text-silver">{track.artist}</p>
                <p className="mt-2 text-sm leading-snug text-chrome">{track.reason}</p>
              </div>
            </li>
          ))}

        {status === 'loading' &&
          Array.from({ length: 6 }, (_, index) => (
            <li key={index} className="window h-[7.5rem] animate-pulse opacity-50" aria-hidden="true" />
          ))}
      </ul>
    </section>
  );
}
