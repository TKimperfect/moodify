import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Window from '../components/ui/Window.jsx';
import Artwork from '../components/ui/Artwork.jsx';
import { LoadingPanel, ErrorPanel } from '../components/ui/StatePanels.jsx';
import SongTile from '../components/music/SongTile.jsx';
import RequireLogin from '../components/account/RequireLogin.jsx';
import MoodSessionList from '../components/account/MoodSessionList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { apiGet } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { timeAgo } from '../lib/time.js';

const TABS = [
  { id: 'favorites', label: 'Favourites' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'recent', label: 'Recently played' },
  { id: 'moods', label: 'Saved moods' },
];

export default function Library() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.id === params.get('tab')) ? params.get('tab') : 'favorites';
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="pixel-label text-rose">My library{user ? ` · ${user.display_name}` : ''}</p>
        <h1 className="chrome-text mt-2 font-display text-[clamp(1.5rem,6vw,2.25rem)] tracking-wider">Your music</h1>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Library sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`btn-ghost ${tab === item.id ? 'border-orchid bg-orchid/10 text-orchid' : ''}`}
            onClick={() => setParams({ tab: item.id }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'favorites' && <Favorites />}
        {tab === 'playlists' && (user ? <Playlists /> : <RequireLogin what="your playlists" />)}
        {tab === 'recent' && (user ? <RecentlyPlayed /> : <RequireLogin what="what you played recently" />)}
        {tab === 'moods' && (user ? <SavedMoods /> : <RequireLogin what="your saved moods" />)}
      </div>
    </div>
  );
}

function SongGrid({ songs, empty }) {
  const player = usePlayer();
  if (songs.length === 0) return <p className="window p-6 text-silver">{empty}</p>;
  return (
    <>
      <button type="button" className="btn-chrome" onClick={() => player.playList(songs, 0)}>
        ▶ Play all ({songs.length})
      </button>
      <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {songs.map((song) => (
          <SongTile key={song.id} song={song} list={songs} />
        ))}
      </ul>
    </>
  );
}

// Favourites: from the account when logged in, otherwise from this browser.
function Favorites() {
  const { user, authFetch } = useAuth();
  const { liked, synced } = useFeedback();
  const key = user ? `user:${user.id}:${synced}` : liked.slice(0, 50).join(',');
  const result = useApi(
    (signal) => {
      if (user) return authFetch('GET', '/favorites', { signal }).then((data) => data.favorites.map((item) => item.song));
      if (!key) return Promise.resolve([]);
      return apiGet('/songs', { params: { ids: key }, signal }).then((data) => data.songs);
    },
    [key],
  );

  if (result.status === 'error') return <ErrorPanel message={result.error} onRetry={result.reload} />;
  if (!result.data || !synced) return <LoadingPanel label="Loading your favourites" />;
  // Un-liking a song on this page removes it straight away.
  const visible = result.data.filter((song) => liked.includes(song.id));

  return (
    <section aria-label="Favourites">
      {!user && (
        <p className="mb-5 text-sm text-silver">
          These favourites are saved in this browser only. <Link to="/login" className="text-orchid underline underline-offset-4">Log in</Link> to keep them everywhere.
        </p>
      )}
      <SongGrid songs={visible} empty="No favourites yet. Tap the heart on any song you love." />
    </section>
  );
}

function Playlists() {
  const { authFetch } = useAuth();
  const result = useApi((signal) => authFetch('GET', '/playlists', { signal }), []);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  async function create(event) {
    event.preventDefault();
    setError(null);
    try {
      await authFetch('POST', '/playlists', { body: { name: name.trim() } });
      setName('');
      result.reload();
    } catch (problem) {
      setError(problem.message);
    }
  }

  return (
    <section aria-label="Playlists" className="space-y-5">
      <form onSubmit={create} className="flex flex-wrap gap-2">
        <label htmlFor="new-playlist" className="sr-only">
          New playlist name
        </label>
        <input
          id="new-playlist"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name a new playlist"
          className="min-w-0 flex-1 rounded-md border border-line bg-ink/70 px-3 py-2.5 text-frost placeholder:text-silver/70 focus:border-orchid focus:outline-none sm:max-w-sm"
        />
        <button type="submit" className="btn-ghost" disabled={!name.trim()}>
          Create playlist
        </button>
      </form>
      {error && (
        <p className="text-sm text-rose" role="alert">
          {error}
        </p>
      )}
      {result.status === 'error' && <ErrorPanel message={result.error} onRetry={result.reload} />}
      {!result.data && result.status === 'loading' && <LoadingPanel label="Loading playlists" />}
      {result.data?.count === 0 && <p className="window p-6 text-silver">No playlists yet. Create one above, or use “+ Playlist” on any song.</p>}
      {result.data?.count > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.playlists.map((playlist) => (
            <li key={playlist.id}>
              <Link to={`/library/playlists/${playlist.id}`} className="window flex items-center gap-4 p-4 transition-colors hover:border-silver">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-line bg-gradient-to-br from-violet to-ink font-display text-xl text-frost">
                  {playlist.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-frost">{playlist.name}</span>
                  <span className="pixel-label text-silver">
                    {playlist.song_count} {playlist.song_count === 1 ? 'song' : 'songs'} · {timeAgo(playlist.updated_at)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentlyPlayed() {
  const { authFetch } = useAuth();
  const player = usePlayer();
  const result = useApi((signal) => authFetch('GET', '/history', { params: { event: 'played', limit: 50 }, signal }), []);
  if (result.status === 'error') return <ErrorPanel message={result.error} onRetry={result.reload} />;
  if (!result.data) return <LoadingPanel label="Loading your listening history" />;

  // The same song may appear many times; show it once, at its latest play.
  const seen = new Set();
  const entries = result.data.history.filter((entry) => !seen.has(entry.song.id) && seen.add(entry.song.id));
  const songs = entries.map((entry) => entry.song);
  if (entries.length === 0) return <p className="window p-6 text-silver">Nothing yet. Songs appear here after you have listened for 30 seconds.</p>;

  return (
    <section aria-label="Recently played">
      <button type="button" className="btn-chrome" onClick={() => player.playList(songs, 0)}>
        ▶ Play again
      </button>
      <ol className="mt-5 space-y-2">
        {entries.map((entry, index) => (
          <li key={entry.id} className="window flex items-center gap-3 p-2.5">
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => player.playList(songs, index)}>
              <Artwork song={entry.song} className="w-11 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-frost">{entry.song.title}</span>
                <span className="block truncate text-sm text-silver">{entry.song.artist}</span>
              </span>
            </button>
            <span className="pixel-label shrink-0 text-silver">{timeAgo(entry.created_at)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SavedMoods() {
  const { authFetch } = useAuth();
  const result = useApi((signal) => authFetch('GET', '/mood-sessions', { params: { limit: 50 }, signal }), []);
  const [error, setError] = useState(null);

  async function remove(session) {
    try {
      await authFetch('DELETE', `/mood-sessions/${session.id}`);
      result.reload();
    } catch (problem) {
      setError(problem.message);
    }
  }

  if (result.status === 'error') return <ErrorPanel message={result.error} onRetry={result.reload} />;
  if (!result.data) return <LoadingPanel label="Loading your saved moods" />;
  if (result.data.count === 0) {
    return (
      <Window title="mood_history.log" status="empty">
        <p className="p-6 text-silver">
          No saved moods yet. Each time you lock in a mood on the <Link to="/" className="text-orchid underline">home page</Link> or with the{' '}
          <Link to="/assistant" className="text-orchid underline">assistant</Link>, it is saved here.
        </p>
      </Window>
    );
  }
  return (
    <section aria-label="Saved moods">
      {error && (
        <p className="mb-3 text-sm text-rose" role="alert">
          {error}
        </p>
      )}
      <MoodSessionList sessions={result.data.mood_sessions} onDelete={remove} />
    </section>
  );
}
