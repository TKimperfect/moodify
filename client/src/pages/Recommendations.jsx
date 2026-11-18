import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Window from '../components/ui/Window.jsx';
import { LoadingPanel, ErrorPanel } from '../components/ui/StatePanels.jsx';
import RecommendationCard from '../components/music/RecommendationCard.jsx';
import { useMoodProfile } from '../context/MoodProfileContext.jsx';
import { useFeedback } from '../context/FeedbackContext.jsx';
import { usePlayer } from '../context/PlayerContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { summarizeProfile } from '../lib/moodProfile.js';
import { apiPost } from '../lib/api.js';
import { useApi } from '../lib/useApi.js';

const LIST_SIZE = 10;

// "For You": songs matched to the saved mood profile.
export default function Recommendations() {
  const { saved, clearSaved } = useMoodProfile();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="pixel-label text-rose">For you</p>
        <h1 className="chrome-text mt-2 font-display text-[clamp(1.25rem,6vw,2.25rem)] tracking-wider">Recommendations</h1>
      </header>

      {saved ? (
        <>
          <Window title="mood_profile.json" status="saved">
            <div className="p-4 sm:p-6">
              <p className="text-lg leading-relaxed text-frost">{summarizeProfile(saved.profile)}</p>
              <details className="mt-4">
                <summary className="pixel-label cursor-pointer text-silver hover:text-orchid">Structured profile</summary>
                <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-ink/70 p-4 font-mono text-xs leading-relaxed text-chrome">
                  {JSON.stringify(saved.profile, null, 2)}
                </pre>
              </details>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-void/60 px-4 py-3 sm:px-6">
              <button type="button" className="btn-ghost" onClick={clearSaved}>
                Delete profile
              </button>
              <Link to="/" className="btn-ghost">
                Adjust profile
              </Link>
            </div>
          </Window>
          {/* "key" restarts the list from scratch whenever the profile changes */}
          <RecommendationList key={JSON.stringify(saved.profile)} profile={saved.profile} />
        </>
      ) : (
        <Window title="mood_profile.json" status="empty">
          <div className="p-6 sm:p-8">
            <p className="text-silver">No mood profile yet. Tell MOODIFY how you feel first, or pick one from your saved moods in the Library.</p>
            <Link to="/" className="btn-chrome mt-6">
              Build my profile
            </Link>
          </div>
        </Window>
      )}
    </div>
  );
}

function RecommendationList({ profile }) {
  const feedback = useFeedback();
  const { rejected, reject, unreject, restoreAllRejected, markShown } = feedback;
  const player = usePlayer();
  const { status: authStatus, authFetch } = useAuth();
  const [round, setRound] = useState(0); // goes up each time the user asks for different songs
  const [lastRejected, setLastRejected] = useState(null);

  // The request always uses the newest likes/rejections, but liking a song
  // does not by itself reload the list (that would be jumpy).
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  const { status, data, error, reload } = useApi(
    (signal) => {
      const { liked, rejected: hidden, recent, skipped } = feedbackRef.current;
      const body = { profile, feedback: { liked, rejected: hidden, recent, skipped }, limit: LIST_SIZE };
      if (authStatus === 'user') return authFetch('POST', '/recommendations', { body, signal, retry: true });
      return apiPost('/recommendations', body, { signal, retry: true });
    },
    [profile, round, authStatus === 'user'],
  );

  // Main list minus rejected songs, topped up from the spare songs.
  const visible = useMemo(() => {
    if (!data) return [];
    return [...data.recommendations, ...data.reserve].filter((item) => !rejected.includes(item.song.id)).slice(0, LIST_SIZE);
  }, [data, rejected]);

  const visibleSongs = useMemo(() => visible.map((item) => item.song), [visible]);

  const alternative = useMemo(
    () => (data ? data.alternative.recommendations.filter((item) => !rejected.includes(item.song.id)) : []),
    [data, rejected],
  );

  const alternativeSongs = useMemo(() => alternative.map((item) => item.song), [alternative]);

  // Move keyboard focus to the list heading after new songs arrive.
  const headingRef = useRef(null);
  useEffect(() => {
    if (status === 'ok' && round > 0) headingRef.current?.focus();
  }, [status, round, data]);

  function handleReject(song) {
    reject(song.id);
    setLastRejected(song);
  }

  function handleUndo() {
    unreject(lastRejected.id);
    setLastRejected(null);
  }

  function showDifferent() {
    markShown(visible.map((item) => item.song.id));
    setLastRejected(null);
    setRound((value) => value + 1);
  }

  if (status === 'error') return <ErrorPanel message={error} onRetry={reload} />;
  if (!data) return <LoadingPanel label="Matching songs to your profile" />;

  return (
    <div className="space-y-10" aria-busy={status === 'loading'}>
      <section aria-labelledby="matches-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="pixel-label text-silver">
              {data.source} engine · {data.meta.catalogue_size} sample songs
              {data.meta.learned_from > 0 && ` · learned from ${data.meta.learned_from} of your ratings`}
              {data.used_favorite_genres && ' · using your favourite genres'}
            </p>
            <h2 id="matches-heading" ref={headingRef} tabIndex={-1} className="mt-2 font-display text-xl tracking-wider text-frost outline-none">
              {visible.length} songs for right now
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-chrome" onClick={() => player.playList(visibleSongs, 0)} disabled={visible.length === 0}>
              ▶ Play all
            </button>
            <button type="button" className="btn-ghost" onClick={showDifferent} disabled={status === 'loading'}>
              {status === 'loading' ? 'Matching…' : 'Show different songs'}
            </button>
          </div>
        </div>

        <div className="mt-3 min-h-6 text-sm text-silver" aria-live="polite">
          {lastRejected && (
            <p>
              “{lastRejected.title}” will not be recommended again.{' '}
              <button type="button" className="text-orchid underline underline-offset-4 hover:text-frost" onClick={handleUndo}>
                Undo
              </button>
            </p>
          )}
        </div>

        <ol className={`mt-2 grid gap-4 transition-opacity ${status === 'loading' ? 'opacity-50' : ''}`}>
          {visible.map((item, index) => (
            <RecommendationCard key={item.song.id} item={item} rank={index + 1} onReject={handleReject} list={visibleSongs} />
          ))}
        </ol>

        {visible.length === 0 && (
          <p className="window p-6 text-silver">Every matching song has been hidden. Restore hidden songs below to see them again.</p>
        )}
      </section>

      {alternative.length > 0 && (
        <section aria-labelledby="alternative-heading">
          <p className="pixel-label text-rose">A different direction</p>
          <h2 id="alternative-heading" className="mt-2 font-display text-xl tracking-wider text-frost">
            Or would you rather: {data.alternative.label.toLowerCase()}?
          </h2>
          <p className="mt-1.5 text-sm text-silver">Same feelings, a different thing to ask of the music.</p>
          <ol className="mt-4 grid gap-4">
            {alternative.map((item) => (
              <RecommendationCard key={item.song.id} item={item} onReject={handleReject} list={alternativeSongs} />
            ))}
          </ol>
        </section>
      )}

      {rejected.length > 0 && (
        <p className="pixel-label flex flex-wrap items-center gap-3 text-silver">
          {rejected.length} hidden {rejected.length === 1 ? 'song' : 'songs'}
          <button type="button" className="btn-ghost" onClick={() => { restoreAllRejected(); setLastRejected(null); }}>
            Restore all
          </button>
        </p>
      )}
    </div>
  );
}
