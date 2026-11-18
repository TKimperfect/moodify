import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Window from '../components/ui/Window.jsx';
import Artwork from '../components/ui/Artwork.jsx';
import { LoadingPanel, ErrorPanel } from '../components/ui/StatePanels.jsx';
import RequireLogin from '../components/account/RequireLogin.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { useApi } from '../lib/useApi.js';

export default function PlaylistDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6 sm:py-16">
      <Link to="/library?tab=playlists" className="pixel-label text-silver hover:text-orchid">
        ← All playlists
      </Link>
      {user ? <Playlist id={id} /> : <RequireLogin what="this playlist" />}
    </div>
  );
}

function Playlist({ id }) {
  const { authFetch } = useAuth();
  const player = usePlayer();
  const navigate = useNavigate();
  const result = useApi((signal) => authFetch('GET', `/playlists/${id}`, { signal }), [id]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [error, setError] = useState(null);

  if (result.status === 'error') return <ErrorPanel message={result.error} onRetry={result.reload} />;
  if (!result.data) return <LoadingPanel label="Loading playlist" />;
  const playlist = result.data.playlist;
  const songs = playlist.songs.map((entry) => entry.song);

  async function act(action) {
    setError(null);
    try {
      await action();
    } catch (problem) {
      setError(problem.message);
    }
  }

  const save = (event) => {
    event.preventDefault();
    act(async () => {
      await authFetch('PATCH', `/playlists/${id}`, { body: { name: form.name.trim(), description: form.description.trim() } });
      setEditing(false);
      result.reload();
    });
  };

  const removeSong = (song) =>
    act(async () => {
      await authFetch('DELETE', `/playlists/${id}/songs/${song.id}`);
      result.reload();
    });

  const removePlaylist = () => {
    if (!window.confirm(`Delete the playlist “${playlist.name}”? The songs stay in MOODIFY.`)) return;
    act(async () => {
      await authFetch('DELETE', `/playlists/${id}`);
      navigate('/library?tab=playlists');
    });
  };

  return (
    <>
      <Window title="playlist.m3u" status={`${playlist.song_count} songs`}>
        <div className="p-5 sm:p-6">
          {editing ? (
            <form onSubmit={save} className="space-y-3">
              <label className="block text-sm text-frost">
                Name
                <input
                  value={form.name}
                  maxLength={80}
                  required
                  onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                  className="mt-1 block w-full rounded-md border border-line bg-ink/70 px-3 py-2 text-frost focus:border-orchid focus:outline-none"
                />
              </label>
              <label className="block text-sm text-frost">
                Description
                <textarea
                  value={form.description}
                  maxLength={300}
                  rows={2}
                  onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
                  className="mt-1 block w-full resize-none rounded-md border border-line bg-ink/70 px-3 py-2 text-frost focus:border-orchid focus:outline-none"
                />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn-chrome" disabled={!form.name.trim()}>
                  Save
                </button>
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="chrome-text break-words font-display text-[clamp(1.5rem,6vw,2.25rem)] tracking-wider">{playlist.name}</h1>
              {playlist.description && <p className="mt-2 text-silver">{playlist.description}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className="btn-chrome" disabled={songs.length === 0} onClick={() => player.playList(songs, 0)}>
                  ▶ Play
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setForm({ name: playlist.name, description: playlist.description });
                    setEditing(true);
                  }}
                >
                  Rename
                </button>
                <button type="button" className="btn-ghost" onClick={removePlaylist}>
                  Delete playlist
                </button>
              </div>
            </>
          )}
          {error && (
            <p className="mt-3 text-sm text-rose" role="alert">
              {error}
            </p>
          )}
        </div>
      </Window>

      {songs.length === 0 ? (
        <p className="window p-6 text-silver">
          This playlist is empty. Use “+ Playlist” on any song in <Link to="/recommendations" className="text-orchid underline">For You</Link> or{' '}
          <Link to="/discover" className="text-orchid underline">Discover</Link>.
        </p>
      ) : (
        <ol className="space-y-2">
          {songs.map((song, index) => (
            <li key={song.id} className={`window flex items-center gap-3 p-2.5 ${player.current?.id === song.id ? 'border-orchid' : ''}`}>
              <span className="pixel-label w-6 text-right text-silver">{index + 1}</span>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => player.playList(songs, index)} aria-label={`Play ${song.title}`}>
                <Artwork song={song} className="w-11 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-frost">{song.title}</span>
                  <span className="block truncate text-sm text-silver">{song.artist}</span>
                </span>
              </button>
              <button type="button" className="icon-btn" onClick={() => removeSong(song)} aria-label={`Remove ${song.title} from this playlist`}>
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
