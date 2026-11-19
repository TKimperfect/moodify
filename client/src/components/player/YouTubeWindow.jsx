import { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { loadYouTubeApi, youtubeErrorMessage } from '../../lib/youtubeApi.js';

// YouTube's own player, shown while a full song plays.
// YouTube's rules: the player must stay visible (at least 200x200 pixels),
// so it is a small window above the player bar rather than hidden.
export default function YouTubeWindow() {
  const { youtube, current, setFullSongs } = usePlayer();
  const holder = useRef(null);
  const player = useRef(null);
  const loadedId = useRef(null);
  const [problem, setProblem] = useState(null);
  const { videoId, events, wantPlay } = youtube;

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
      aria-label={`YouTube video: ${current?.title ?? ''}`}
      // Phones: under the header. Wider screens: bottom left, clear of the queue (bottom right).
      className="window fixed inset-x-2 top-[4.75rem] z-40 sm:inset-x-auto sm:left-6 sm:top-auto sm:bottom-[7.5rem] sm:w-[22.5rem]"
    >
      <div className="window-bar">
        <span className="pixel-label truncate">full song · youtube</span>
        <button type="button" className="pixel-label shrink-0 hover:text-frost" onClick={() => setFullSongs(false)}>
          use 30s previews
        </button>
      </div>
      {/* 16:9, never smaller than 200px tall (YouTube's minimum player size) */}
      <div className="relative aspect-video min-h-[200px] w-full bg-ink" ref={holder}>
        {!videoId && !problem && <p className="pixel-label absolute inset-0 grid place-items-center text-silver">finding the video…</p>}
      </div>
    </section>
  );
}
