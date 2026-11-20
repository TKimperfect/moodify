import { useEffect, useState } from 'react';
import Choice from '../components/ui/Choice.jsx';
import { LoadingPanel, ErrorPanel } from '../components/ui/StatePanels.jsx';
import SongTile from '../components/music/SongTile.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { MOODS } from '../data/moods.js';
import { languageShort } from '../data/languages.js';
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
          <Browse genres={discover.data.genres} moods={discover.data.moods} languages={discover.data.languages ?? []} />
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

const PAGE = 24; // songs per "Show more"
// A number for this filter and mix: every new filter gets a new order,
// "Shuffle again" another one, and "Show more" keeps the current one.
const seedFor = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash % 2147483647;
};

// Mood playlists + genre discovery + search, combined into one browser.
function Browse({ genres, moods, languages }) {
  const [mood, setMood] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  // Wait until typing pauses before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const active = Boolean(mood || genre || language || query);
  // Shuffled by default, so the same filter does not always open on the same songs.
  const [sort, setSort] = useState('shuffle');
  const [visit] = useState(() => Math.floor(Math.random() * 2147483647));
  const [mix, setMix] = useState(0);
  const seed = seedFor(`${visit}|${mood}|${genre}|${language}|${query}|${mix}`);
  const order = sort === 'shuffle' ? { sort, seed } : { sort };
  const results = useApi(
    (signal) => (active ? apiGet('/songs', { params: { mood, genre, language, q: query, limit: PAGE, ...order }, signal }) : Promise.resolve(null)),
    [mood, genre, language, query, sort, seed],
  );
  // "Show more": the next pages, added below the first one. A new filter or order starts again.
  const [more, setMore] = useState({ key: '', songs: [], status: 'idle', error: null });
  const filterKey = [mood, genre, language, query, sort, seed].join('|');
  const extra = more.key === filterKey ? more : { key: filterKey, songs: [], status: 'idle', error: null };
  const shown = results.data ? [...results.data.songs, ...extra.songs] : [];
  const total = results.data?.total ?? results.data?.count ?? 0;
  const showMore = async () => {
    setMore({ ...extra, status: 'loading', error: null });
    try {
      const page = await apiGet('/songs', { params: { mood, genre, language, q: query, limit: PAGE, offset: shown.length, ...order } });
      setMore((current) => (current.key === filterKey ? { ...current, songs: [...current.songs, ...page.songs], status: 'idle' } : current));
    } catch (error) {
      setMore((current) => (current.key === filterKey ? { ...current, status: 'error', error: error.message } : current));
    }
  };
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

        {languages.some((item) => item.count > 0 && item.id !== 'instrumental') && (
          <fieldset>
            <legend className="font-medium text-frost">Language</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Choice name="browse-language" value="" label="Any" checked={language === ''} onChange={() => setLanguage('')} className="choice-compact" />
              {languages
                .filter((item) => item.count > 0)
                .map((item) => (
                  <Choice
                    key={item.id}
                    name="browse-language"
                    value={item.id}
                    label={`${languageShort(item.id)} · ${item.count}`}
                    checked={language === item.id}
                    onChange={() => setLanguage(item.id)}
                    className="choice-compact"
                  />
                ))}
            </div>
          </fieldset>
        )}

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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="pixel-label text-silver">
                  {total} {total === 1 ? 'song' : 'songs'} found{shown.length < total ? ` · showing ${shown.length}` : ''}
                </p>
                {total > 1 && (
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Order">
                    <button type="button" className={`btn-ghost ${sort === 'shuffle' ? 'border-orchid bg-orchid/10 text-orchid' : ''}`} aria-pressed={sort === 'shuffle'} onClick={() => setSort('shuffle')}>
                      Shuffled
                    </button>
                    <button type="button" className={`btn-ghost ${sort === 'popular' ? 'border-orchid bg-orchid/10 text-orchid' : ''}`} aria-pressed={sort === 'popular'} onClick={() => setSort('popular')}>
                      Most popular
                    </button>
                    {sort === 'shuffle' && (
                      <button type="button" className="btn-ghost" onClick={() => setMix((value) => value + 1)} aria-label="Shuffle again">
                        ↻ Shuffle again
                      </button>
                    )}
                  </div>
                )}
              </div>
              {total === 0 ? (
                <p className="mt-3 text-silver">Nothing matches that combination. Try removing a filter.</p>
              ) : (
                <ul className={`mt-4 grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${results.status === 'loading' ? 'opacity-50' : ''}`}>
                  {shown.map((song) => (
                    <SongTile key={song.id} song={song} list={shown} />
                  ))}
                </ul>
              )}
              {shown.length < total && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-ghost" onClick={showMore} disabled={extra.status === 'loading'}>
                    {extra.status === 'loading' ? 'Loading…' : `Show ${Math.min(PAGE, total - shown.length)} more`}
                  </button>
                  {extra.status === 'error' && <span className="text-rose">{extra.error}</span>}
                </div>
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
