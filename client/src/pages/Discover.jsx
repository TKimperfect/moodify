import { useEffect, useState } from 'react';
import Choice from '../components/ui/Choice.jsx';
import { LoadingPanel, ErrorPanel } from '../components/ui/StatePanels.jsx';
import SongTile from '../components/music/SongTile.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { MOODS } from '../data/moods.js';
import { apiGet } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';

// Discover: browse the catalogue without building a mood profile.
export default function Discover() {
  const discover = useApi((signal) => apiGet('/songs/discover', { signal }), []);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="pixel-label text-rose">Discover // sample catalogue</p>
        <h1 className="chrome-text mt-2 font-display text-3xl tracking-wider sm:text-4xl">Look around</h1>
        <p className="mt-3 max-w-xl text-silver">Browse by mood or genre, or see what is trending and what is overlooked.</p>
      </header>

      {discover.status === 'error' && <ErrorPanel message={discover.error} onRetry={discover.reload} />}
      {discover.status === 'loading' && !discover.data && <LoadingPanel label="Loading the catalogue" />}

      {discover.data && (
        <>
          <Browse genres={discover.data.genres} moods={discover.data.moods} />
          <Shelf id="trending" label="Trending" title="Most played right now" songs={discover.data.trending} />
          <Shelf id="gems" label="Hidden gems" title="Overlooked, worth your time" songs={discover.data.hidden_gems} />
          <Shelf id="newest" label="New" title="Latest additions" songs={discover.data.newest} />
          <RecentlyDiscovered />
          <RealSearch />
        </>
      )}
    </div>
  );
}

function Shelf({ id, label, title, songs }) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <p className="pixel-label text-rose">{label}</p>
      <h2 id={`${id}-heading`} className="mt-2 font-display text-xl tracking-wider text-frost">
        {title}
      </h2>
      <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {songs.map((song) => (
          <SongTile key={song.id} song={song} list={songs} />
        ))}
      </ul>
    </section>
  );
}

// Mood playlists + genre discovery + search, combined into one browser.
function Browse({ genres, moods }) {
  const [mood, setMood] = useState('');
  const [genre, setGenre] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  // Wait until typing pauses before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const active = Boolean(mood || genre || query);
  const results = useApi(
    (signal) => (active ? apiGet('/songs', { params: { mood, genre, q: query, limit: 24 }, signal }) : Promise.resolve(null)),
    [mood, genre, query],
  );
  const moodCount = (id) => moods.find((item) => item.id === id)?.count ?? 0;

  return (
    <section className="window" aria-labelledby="browse-heading">
      <div className="window-bar">
        <span className="pixel-label">browse.exe</span>
        <span className="pixel-label text-rose">{active ? 'filtered' : 'pick a filter'}</span>
      </div>
      <div className="space-y-6 p-4 sm:p-6">
        <h2 id="browse-heading" className="font-display text-lg tracking-wider text-frost">
          Mood playlists and genres
        </h2>

        <div>
          <label htmlFor="song-search" className="font-medium text-frost">
            Search
          </label>
          <input
            id="song-search"
            type="search"
            value={text}
            maxLength={80}
            onChange={(event) => setText(event.target.value)}
            placeholder="Song or artist"
            className="mt-2 block w-full rounded-md border border-line bg-ink/70 px-3 py-2.5 text-frost placeholder:text-silver/70 focus:border-orchid focus:outline-none sm:max-w-sm"
          />
        </div>

        <fieldset>
          <legend className="font-medium text-frost">Mood</legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Choice name="browse-mood" value="" label="Any" checked={mood === ''} onChange={() => setMood('')} className="choice-compact" />
            {MOODS.map((item) => (
              <Choice
                key={item.id}
                name="browse-mood"
                value={item.id}
                label={`${item.label} · ${moodCount(item.id)}`}
                checked={mood === item.id}
                onChange={() => setMood(item.id)}
                className="choice-compact"
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-medium text-frost">Genre</legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Choice name="browse-genre" value="" label="Any" checked={genre === ''} onChange={() => setGenre('')} className="choice-compact" />
            {genres.map((item) => (
              <Choice
                key={item.id}
                name="browse-genre"
                value={item.id}
                label={`${item.label} · ${item.count}`}
                checked={genre === item.id}
                onChange={() => setGenre(item.id)}
                className="choice-compact"
              />
            ))}
          </div>
        </fieldset>

        <div aria-live="polite">
          {results.status === 'error' && <ErrorPanel message={results.error} onRetry={results.reload} />}
          {active && results.data && (
            <>
              <p className="pixel-label text-silver">
                {results.data.count} {results.data.count === 1 ? 'song' : 'songs'} found
              </p>
              {results.data.count === 0 ? (
                <p className="mt-3 text-silver">Nothing matches that combination. Try removing a filter.</p>
              ) : (
                <ul className={`mt-4 grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${results.status === 'loading' ? 'opacity-50' : ''}`}>
                  {results.data.songs.map((song) => (
                    <SongTile key={song.id} song={song} list={results.data.songs} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// Songs MOODIFY has recommended to this user lately.
function RecentlyDiscovered() {
  const { recent, rejected } = useFeedback();
  const ids = recent.filter((id) => !rejected.includes(id)).slice(0, 8);
  const key = ids.join(',');
  const { data } = useApi((signal) => (key ? apiGet('/songs', { params: { ids: key }, signal }) : Promise.resolve(null)), [key]);

  if (!key || !data || data.songs.length === 0) return null;
  return <Shelf id="recent" label="Recently discovered" title="Recommended to you lately" songs={data.songs} />;
}

// Search real songs on the music services this server has switched on.
const SOURCE_INFO = {
  deezer: 'Well-known songs with 30-second previews from Deezer.',
  jamendo: 'Full songs by independent artists, free under Creative Commons licences.',
  spotify: 'Song information from Spotify. Spotify gives previews for few songs, so most open in Spotify.',
};

function RealSearch() {
  const providers = useApi((signal) => apiGet('/music/providers', { signal }), []);
  const sources = ['deezer', 'jamendo', 'spotify'].filter((id) => providers.data?.providers?.[id]?.enabled);
  const [source, setSource] = useState(null);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const active = source && sources.includes(source) ? source : sources[0];
  const results = useApi(
    (signal) => (query && active ? apiGet('/music/search', { params: { q: query, source: active }, signal }) : Promise.resolve(null)),
    [query, active],
  );

  if (sources.length === 0) return null;
  const label = (id) => providers.data.providers[id].label;

  return (
    <section className="window" aria-labelledby="real-search-heading">
      <div className="window-bar">
        <span className="pixel-label">real_music.exe</span>
        <span className="pixel-label text-rose">{label(active)}</span>
      </div>
      <div className="space-y-5 p-4 sm:p-6">
        <div>
          <h2 id="real-search-heading" className="font-display text-lg tracking-wider text-frost">
            Search real music
          </h2>
          <p className="mt-1.5 text-sm text-silver">{SOURCE_INFO[active]}</p>
        </div>

        {sources.length > 1 && (
          <fieldset>
            <legend className="sr-only">Music service</legend>
            <div className="flex flex-wrap gap-2">
              {sources.map((id) => (
                <Choice key={id} name="real-source" value={id} label={label(id)} checked={active === id} onChange={() => setSource(id)} className="choice-compact" />
              ))}
            </div>
          </fieldset>
        )}

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(text.trim());
          }}
        >
          <label htmlFor="real-search" className="sr-only">
            Song or artist
          </label>
          <input
            id="real-search"
            type="search"
            value={text}
            maxLength={100}
            onChange={(event) => setText(event.target.value)}
            placeholder={active === 'jamendo' ? 'Artist, song or mood, e.g. piano' : 'Song or artist'}
            className="min-w-0 flex-1 rounded-md border border-line bg-ink/70 px-3 py-2.5 text-frost placeholder:text-silver/70 focus:border-orchid focus:outline-none sm:max-w-sm"
          />
          <button type="submit" className="btn-ghost" disabled={!text.trim()}>
            Search
          </button>
        </form>

        <div aria-live="polite">
          {results.status === 'error' && <ErrorPanel message={results.error} onRetry={results.reload} />}
          {query && results.status === 'loading' && <p className="pixel-label text-silver">&gt; searching {label(active)}…</p>}
          {results.data && results.data.count === 0 && <p className="text-silver">No songs found.</p>}
          {results.data?.count > 0 && (
            <ul className={`grid grid-cols-1 gap-4 transition-opacity md:grid-cols-2 ${results.status === 'loading' ? 'opacity-50' : ''}`}>
              {results.data.songs.map((song) => (
                <SongTile key={song.id} song={song} list={results.data.songs} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
