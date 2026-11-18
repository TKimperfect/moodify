import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

// "+ Playlist" button with a small menu of the user's playlists.
export default function AddToPlaylist({ song }) {
  const { status, authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState(null);
  const [message, setMessage] = useState(null);
  const [newName, setNewName] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setMessage(null);
    authFetch('GET', '/playlists')
      .then((result) => setPlaylists(result.playlists))
      .catch((error) => setMessage(error.message));
    const close = (event) => {
      if (event.key === 'Escape' || (event.type === 'mousedown' && !box.current?.contains(event.target))) setOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('mousedown', close);
    };
  }, [open, authFetch]);

  if (song.external || status !== 'user') return null;

  async function addTo(playlist) {
    try {
      await authFetch('POST', `/playlists/${playlist.id}/songs`, { body: { song_id: song.id } });
      setMessage(`Added to “${playlist.name}”`);
    } catch (error) {
      setMessage(error.status === 409 ? `Already in “${playlist.name}”` : error.message);
    }
  }

  async function create(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const result = await authFetch('POST', '/playlists', { body: { name, song_ids: [song.id] } });
      setPlaylists((list) => [result.playlist, ...(list ?? [])]);
      setNewName('');
      setMessage(`Created “${result.playlist.name}” with this song`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="relative" ref={box}>
      <button type="button" className="icon-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}>
        + Playlist
      </button>
      {open && (
        <div className="window absolute bottom-full left-0 z-30 mb-2 w-64 p-2" role="dialog" aria-label={`Add ${song.title} to a playlist`}>
          {playlists === null && !message && <p className="pixel-label p-2 text-silver">loading…</p>}
          {playlists?.length > 0 && (
            <ul className="max-h-48 overflow-y-auto">
              {playlists.map((playlist) => (
                <li key={playlist.id}>
                  <button type="button" onClick={() => addTo(playlist)} className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-chrome hover:bg-white/5 hover:text-frost">
                    {playlist.name} <span className="text-xs text-silver">· {playlist.song_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={create} className="mt-2 flex gap-1.5 border-t border-line pt-2">
            <label htmlFor={`new-playlist-${song.id}`} className="sr-only">
              New playlist name
            </label>
            <input
              id={`new-playlist-${song.id}`}
              value={newName}
              maxLength={80}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="New playlist"
              className="min-w-0 flex-1 rounded border border-line bg-ink/70 px-2 py-1 text-sm text-frost focus:border-orchid focus:outline-none"
            />
            <button type="submit" className="icon-btn" disabled={!newName.trim()}>
              Create
            </button>
          </form>
          {message && (
            <p className="mt-2 px-1 text-xs text-orchid" role="status">
              {message}
            </p>
          )}
          <Link to="/library?tab=playlists" className="pixel-label mt-2 block px-1 text-silver hover:text-orchid">
            Manage playlists →
          </Link>
        </div>
      )}
    </div>
  );
}
