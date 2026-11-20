import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { loadYouTubeApi, youtubeErrorMessage } from '../../lib/youtubeApi.js';

// Where the listener last moved the window (kept in this browser only).
const POSITION_KEY = 'moodify.youtubeWindow';
function savedPosition() {
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY));
    return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? value : null;
  } catch {
    return null;
  }
}
function savePosition(position) {
  try {
    if (position) localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    else localStorage.removeItem(POSITION_KEY);
  } catch {
    // private window or storage blocked: the position is simply not remembered
  }
}
// Window sizes. YouTube requires the player to be at least 200x200 pixels,
// so "small" is a 220px wide window whose video area stays 200px tall.
const SIZES = {
  small: { label: 's', name: 'small', width: '13.75rem' },
  medium: { label: 'm', name: 'medium', width: 'min(22.5rem, calc(100vw - 1rem))' },
  large: { label: 'l', name: 'large', width: 'min(32rem, calc(100vw - 1rem))' },
};
const SIZE_ORDER = ['small', 'medium', 'large'];
const SIZE_KEY = 'moodify.youtubeWindowSize';
function savedSize() {
  try {
    const value = localStorage.getItem(SIZE_KEY);
    return SIZES[value] ? value : 'medium';
  } catch {
    return 'medium';
  }
}

// Keeps the whole window on screen, below the site's header and above the
// player bar, so its title bar can always be grabbed again.
function clamp(position, box) {
  if (!position || !box) return position;
  const top = document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom ?? 0;
  const bottom = document.querySelector('.player-bar')?.getBoundingClientRect().top ?? window.innerHeight;
  const maxX = Math.max(0, window.innerWidth - box.width);
  const maxY = Math.max(top, bottom - box.height);
  return { ...position, x: Math.min(Math.max(0, position.x), maxX), y: Math.min(Math.max(top, position.y), maxY) };
}

// YouTube's own player, shown while a full song plays.
// YouTube's rules: the player must stay visible (at least 200x200 pixels),
// so it is a small window above the player bar rather than hidden.
// hidden / onHide: hiding is controlled by the player bar (see PlayerBar.jsx).
export default function YouTubeWindow({ hidden = false, onHide }) {
  const { youtube, current, setFullSongs } = usePlayer();
  const holder = useRef(null);
  const player = useRef(null);
  const loadedId = useRef(null);
  const [problem, setProblem] = useState(null);
  const { videoId, events, wantPlay } = youtube;
  const box = useRef(null);
  const drag = useRef(null);
  // null = the usual place (bottom left; under the header on phones).
  const [position, setPosition] = useState(savedPosition);

  // A remembered position must still fit when the window or screen changes size.
  useEffect(() => {
    const fit = () => setPosition((current) => clamp(current, box.current?.getBoundingClientRect()));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // Drag the window by its title bar.
  const startDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = box.current.getBoundingClientRect();
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveDrag = (event) => {
    if (!drag.current) return;
    const next = { x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy };
    setPosition(clamp(next, box.current.getBoundingClientRect()));
  };
  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    setPosition((current) => {
      savePosition(current);
      return current;
    });
  };
  // Arrow keys move it too (Shift = bigger steps); Home puts it back.
  const onKey = (event) => {
    const step = event.shiftKey ? 80 : 20;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (event.key === 'Home') {
      setPosition(null);
      savePosition(null);
      event.preventDefault();
      return;
    }
    if (!moves[event.key]) return;
    const rect = box.current.getBoundingClientRect();
    const next = clamp({ x: rect.left + moves[event.key][0], y: rect.top + moves[event.key][1] }, rect);
    setPosition(next);
    savePosition(next);
    event.preventDefault();
  };
  // Small, medium or large (remembered in this browser).
  const [size, setSize] = useState(savedSize);
  const nextSize = SIZE_ORDER[(SIZE_ORDER.indexOf(size) + 1) % SIZE_ORDER.length];
  const changeSize = () => {
    setSize(nextSize);
    try {
      localStorage.setItem(SIZE_KEY, nextSize);
    } catch {
      // storage blocked: the size is simply not remembered
    }
  };
  // A bigger window must still fit where it was moved to.
  useEffect(() => {
    setPosition((current) => clamp(current, box.current?.getBoundingClientRect()));
  }, [size]);
  const small = size === 'small';

  const placed = { width: SIZES[size].width, ...(position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : {}) };

  // Create the player once; afterwards just switch videos.
  useEffect(() => {
    if (!videoId) return undefined;
    let cancelled = false;
    if (player.current) {
      if (loadedId.current !== videoId) {
        loadedId.current = videoId;
        if (wantPlay.current) player.current.loadVideoById(videoId);
        else player.current.cueVideoById(videoId);
      }
      return undefined;
    }
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !holder.current) return;
        loadedId.current = videoId;
        const target = document.createElement('div');
        holder.current.replaceChildren(target);
        player.current = new YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: wantPlay.current ? 1 : 0, playsinline: 1, rel: 0 },
          events: {
            onReady: (event) => events.ready(event.target),
            onStateChange: (event) => events.state(event.data, event.target),
            onError: (event) => events.error(youtubeErrorMessage(event.data)),
          },
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setProblem(error.message);
          events.error(error.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, events, wantPlay]);

  // Remove the player when the window closes.
  useEffect(
    () => () => {
      player.current?.destroy?.();
      player.current = null;
      events.gone();
    },
    [events],
  );

  return (
    <section
      ref={box}
      style={placed}
      hidden={hidden}
      aria-label={`YouTube video: ${current?.title ?? ''}`}
      // Phones: under the header. Wider screens: bottom left, clear of the queue (bottom right).
      className="window fixed left-2 top-[4.75rem] z-40 sm:left-6 sm:top-auto sm:bottom-[7.5rem]"
    >
      <div
        className="window-bar cursor-move touch-none select-none"
        role="toolbar"
        tabIndex={0}
        title="Drag to move · double-click to put it back"
        aria-label="YouTube window: drag, or use the arrow keys, to move it; Home puts it back"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKey}
        onDoubleClick={() => {
          setPosition(null);
          savePosition(null);
        }}
      >
        <span className="pixel-label truncate">
          {small ? '' : <span className="sm:hidden">youtube</span>}
          {small ? '' : <span className="hidden sm:inline">full song · youtube</span>}
        </span>
        {/* Padding gives fingers a big enough target; the negative margin keeps the bar slim. */}
        <span className="-my-2 flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="pixel-label rounded px-2 py-2.5 hover:text-frost"
            onClick={changeSize}
            aria-label={`Window size: ${SIZES[size].name}. Change to ${SIZES[nextSize].name}`}
            title={`Size: ${SIZES[size].name} (click for ${SIZES[nextSize].name})`}
          >
            size {SIZES[size].label}
          </button>
          <button
            type="button"
            className="pixel-label rounded px-2 py-2.5 hover:text-frost"
            onClick={() => setFullSongs(false)}
            aria-label="Use 30-second previews instead of whole songs"
            title="Use 30-second previews instead of whole songs"
          >
            {small ? '30s' : <><span className="sm:hidden">30s previews</span><span className="hidden sm:inline">use 30s previews</span></>}
          </button>
          <button
            type="button"
            className="pixel-label rounded px-2 py-2.5 hover:text-frost"
            onClick={onHide}
            aria-label="Hide the video (pauses the song: YouTube songs only play while the video is visible). Show it again from the player bar."
            title="Hide the video (pauses the song). Show it again from the player bar."
          >
            hide —
          </button>
        </span>
      </div>
      {/* 16:9, never smaller than 200px tall (YouTube's minimum player size). The whole window is hidden only while paused. */}
      <div className="relative aspect-video min-h-[200px] w-full bg-ink" ref={holder}>
        {!videoId && !problem && <p className="pixel-label absolute inset-0 grid place-items-center text-silver">finding the video…</p>}
      </div>
    </section>
  );
}
