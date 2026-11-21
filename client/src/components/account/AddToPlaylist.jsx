import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

const MENU_WIDTH = 256; // px (16rem)
const EDGE = 8; // px kept free at the screen edges

// Where the menu goes: next to the button, but always fully on screen
// (above the button when there is room, otherwise below it).
function placeMenu(button, menu) {
  const rect = button.getBoundingClientRect();
  const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2);
  const height = menu?.offsetHeight ?? 260;
  const top =
    document.querySelector("[data-site-header]")?.getBoundingClientRect()
      .bottom ?? 0;
  const bottom =
    document.querySelector(".player-bar")?.getBoundingClientRect().top ??
    window.innerHeight;
  const left = Math.min(
    Math.max(EDGE, rect.left),
    window.innerWidth - width - EDGE,
  );
  const above = rect.top - 8 - height;
  const y =
    above >= top + EDGE
      ? above
      : Math.min(rect.bottom + 8, Math.max(top + EDGE, bottom - height - EDGE));
  return { left, top: y, width };
}
import { useAuth } from "../../context/AuthContext.jsx";

// "+ Playlist" button with a small menu of the user's playlists.
export default function AddToPlaylist({ song }) {
  const { status, authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState(null);
  const [message, setMessage] = useState(null);
  const [newName, setNewName] = useState("");
  const box = useRef(null);
  const button = useRef(null);
  const menu = useRef(null);
  const [place, setPlace] = useState(null);

  // Keep the menu next to its button while the page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const update = () => setPlace(placeMenu(button.current, menu.current));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, playlists, message]);

  useEffect(() => {
    if (!open) return undefined;
    setMessage(null);
    authFetch("GET", "/playlists")
      .then((result) => setPlaylists(result.playlists))
      .catch((error) => setMessage(error.message));
    const close = (event) => {
      const inside =
        box.current?.contains(event.target) ||
        menu.current?.contains(event.target);
      if (event.key === "Escape" || (event.type === "mousedown" && !inside))
        setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("mousedown", close);
    };
  }, [open, authFetch]);

  if (song.external || status !== "user") return null;

  async function addTo(playlist) {
    try {
      await authFetch("POST", `/playlists/${playlist.id}/songs`, {
        body: { song_id: song.id },
      });
      setMessage(`Added to “${playlist.name}”`);
    } catch (error) {
      setMessage(
        error.status === 409 ? `Already in “${playlist.name}”` : error.message,
      );
    }
  }

  async function create(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const result = await authFetch("POST", "/playlists", {
        body: { name, song_ids: [song.id] },
      });
      setPlaylists((list) => [result.playlist, ...(list ?? [])]);
      setNewName("");
      setMessage(`Created “${result.playlist.name}” with this song`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="relative" ref={box}>
      <button
        ref={button}
        type="button"
        className="icon-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        + Playlist
      </button>
      {open &&
        // Drawn on the page itself, so the song card cannot cut it off.
        createPortal(
          <div
            ref={menu}
            className="window fixed z-50 p-2"
            style={place ?? { visibility: "hidden" }}
            role="dialog"
            aria-label={`Add ${song.title} to a playlist`}
          >
            {playlists === null && !message && (
              <p className="pixel-label p-2 text-silver">loading…</p>
            )}
            {playlists?.length > 0 && (
              <ul className="max-h-48 overflow-y-auto">
                {playlists.map((playlist) => (
                  <li key={playlist.id}>
                    <button
                      type="button"
                      onClick={() => addTo(playlist)}
                      className="block w-full truncate rounded px-2 py-1.5 text-left text-sm text-chrome hover:bg-white/5 hover:text-frost"
                    >
                      {playlist.name}{" "}
                      <span className="text-xs text-silver">
                        · {playlist.song_count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={create}
              className="mt-2 flex gap-1.5 border-t border-line pt-2"
            >
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
              <button
                type="submit"
                className="icon-btn"
                disabled={!newName.trim()}
              >
                Create
              </button>
            </form>
            {message && (
              <p className="mt-2 px-1 text-xs text-orchid" role="status">
                {message}
              </p>
            )}
            <Link
              to="/library?tab=playlists"
              className="pixel-label mt-2 block px-1 text-silver hover:text-orchid"
            >
              Manage playlists →
            </Link>
          </div>,
          document.body,
        )}
    </div>
  );
}
