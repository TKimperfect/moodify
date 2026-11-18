import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Window from '../components/ui/Window.jsx';
import Choice from '../components/ui/Choice.jsx';
import { LoadingPanel, ErrorPanel } from '../components/ui/StatePanels.jsx';
import RequireLogin from '../components/account/RequireLogin.jsx';
import MoodSessionList from '../components/account/MoodSessionList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../lib/useApi.js';
import { GENRES, DESIRED_EFFECTS } from '../data/spectrum.js';
import { MOODS } from '../data/moods.js';
import { removeKey } from '../lib/storage.js';

export default function Profile() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6 sm:py-16">
      <header>
        <p className="pixel-label text-rose">Profile</p>
        <h1 className="chrome-text mt-2 break-words font-display text-[clamp(1.5rem,6vw,2.25rem)] tracking-wider">{user ? user.display_name : 'Your profile'}</h1>
      </header>
      {user ? (
        <>
          <AccountDetails />
          <MusicPreferences />
          <MoodHistory />
          <AccountSettings />
        </>
      ) : (
        <>
          <RequireLogin what="your profile and mood history" />
          <DeviceData />
        </>
      )}
    </div>
  );
}

function SaveState({ state }) {
  if (!state) return null;
  return (
    <span className={`text-sm ${state.error ? 'text-rose' : 'text-orchid'}`} role="status">
      {state.error ?? state.text}
    </span>
  );
}

function AccountDetails() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user.display_name);
  const [state, setState] = useState(null);

  async function save(event) {
    event.preventDefault();
    try {
      await updateProfile({ display_name: name.trim() });
      setState({ text: 'Saved' });
    } catch (error) {
      setState({ error: error.message });
    }
  }

  return (
    <Window title="account.cfg" status="you">
      <form onSubmit={save} className="space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg tracking-wider text-frost">Account</h2>
        <p className="text-sm text-silver">
          Email: <span className="text-chrome">{user.email}</span> · member since {new Date(user.created_at).toLocaleDateString()}
        </p>
        <div>
          <label htmlFor="display-name" className="block text-sm font-medium text-frost">
            Display name
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="display-name"
              value={name}
              maxLength={60}
              onChange={(event) => {
                setName(event.target.value);
                setState(null);
              }}
              className="min-w-0 flex-1 rounded-md border border-line bg-ink/70 px-3 py-2.5 text-frost focus:border-orchid focus:outline-none sm:max-w-xs"
            />
            <button type="submit" className="btn-ghost" disabled={!name.trim() || name.trim() === user.display_name}>
              Save
            </button>
          </div>
        </div>
        <SaveState state={state} />
      </form>
    </Window>
  );
}

function MusicPreferences() {
  const { user, updateProfile } = useAuth();
  const [genres, setGenres] = useState(user.favorite_genres);
  const [state, setState] = useState(null);
  const changed = [...genres].sort().join() !== [...user.favorite_genres].sort().join();

  const toggle = (id) => {
    setState(null);
    setGenres((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  };

  async function save() {
    try {
      await updateProfile({ favorite_genres: genres });
      setState({ text: 'Saved. These are used whenever you do not pick genres for a mood.' });
    } catch (error) {
      setState({ error: error.message });
    }
  }

  return (
    <Window title="preferences.cfg" status="music">
      <div className="space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg tracking-wider text-frost">Music preferences</h2>
        <fieldset>
          <legend className="text-sm text-silver">Favourite genres. Recommendations lean towards these when you don't choose genres for a mood.</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {GENRES.map((genre) => (
              <Choice key={genre.id} type="checkbox" name="favorite-genres" value={genre.id} label={genre.label} checked={genres.includes(genre.id)} onChange={() => toggle(genre.id)} className="choice-compact" />
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ghost" onClick={save} disabled={!changed}>
            Save preferences
          </button>
          <SaveState state={state} />
        </div>
      </div>
    </Window>
  );
}

// Counts how often each item appears, most frequent first.
function tally(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function MoodHistory() {
  const { authFetch } = useAuth();
  const result = useApi((signal) => authFetch('GET', '/mood-sessions', { params: { limit: 100 }, signal }), []);
  const sessions = result.data?.mood_sessions ?? [];
  const moods = useMemo(() => tally(sessions.flatMap((session) => session.moods)), [sessions]);
  const effects = useMemo(() => tally(sessions.map((session) => session.desired_effect)), [sessions]);
  const label = (list, id) => list.find((item) => item.id === id)?.label ?? id;

  return (
    <Window title="mood_history.log" status={`${sessions.length} saved`}>
      <div className="space-y-5 p-5 sm:p-6">
        <h2 className="font-display text-lg tracking-wider text-frost">Mood history</h2>
        {result.status === 'error' && <ErrorPanel message={result.error} onRetry={result.reload} />}
        {!result.data && result.status === 'loading' && <LoadingPanel label="Loading your moods" />}
        {result.data && sessions.length === 0 && <p className="text-silver">Nothing yet. Moods you lock in are saved here.</p>}
        {sessions.length > 0 && (
          <>
            <p className="text-xs text-silver">A record of what you chose, not an assessment of how you are. Delete any entry whenever you like.</p>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm text-silver">Moods you picked most</h3>
                <ul className="mt-3 space-y-2">
                  {moods.slice(0, 5).map(([id, count]) => (
                    <li key={id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
                      <span className="text-chrome">{label(MOODS, id)}</span>
                      <span className="h-1.5 overflow-hidden rounded-full border border-line bg-ink" aria-hidden="true">
                        <span className="block h-full bg-gradient-to-r from-violet to-orchid" style={{ width: `${(count / moods[0][1]) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-silver">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm text-silver">What you wanted from music</h3>
                <ul className="mt-3 space-y-2">
                  {effects.slice(0, 5).map(([id, count]) => (
                    <li key={id} className="flex justify-between text-sm">
                      <span className="text-chrome">{label(DESIRED_EFFECTS, id)}</span>
                      <span className="tabular-nums text-silver">{count}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm text-silver">Latest</h3>
              <MoodSessionList sessions={sessions.slice(0, 3)} />
              <Link to="/library?tab=moods" className="pixel-label mt-3 inline-block text-silver hover:text-orchid">
                All saved moods →
              </Link>
            </div>
          </>
        )}
      </div>
    </Window>
  );
}

function AccountSettings() {
  const { logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState('');
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await deleteAccount();
      navigate('/', { replace: true });
    } catch (error) {
      setState({ error: error.message });
      setBusy(false);
    }
  }

  return (
    <Window title="settings.cfg" status="account">
      <div className="space-y-6 p-5 sm:p-6">
        <h2 className="font-display text-lg tracking-wider text-frost">Account settings</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Log out
          </button>
          <span className="text-sm text-silver">Your library stays in your account.</span>
        </div>
        <DeviceData inline />
        <form onSubmit={remove} className="space-y-3 rounded-md border border-rose/40 p-4">
          <h3 className="font-medium text-rose">Delete account</h3>
          <p className="text-sm text-silver">This permanently deletes your account, favourites, playlists, listening history and saved moods. It cannot be undone.</p>
          <label htmlFor="confirm-delete" className="block text-sm text-chrome">
            Type DELETE to confirm
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              className="w-40 rounded-md border border-line bg-ink/70 px-3 py-2 text-frost focus:border-rose focus:outline-none"
            />
            <button type="submit" className="btn-ghost border-rose/60 text-rose" disabled={confirmText !== 'DELETE' || busy}>
              {busy ? 'Deleting…' : 'Delete my account'}
            </button>
          </div>
          <SaveState state={state} />
        </form>
      </div>
    </Window>
  );
}

// Clears what MOODIFY keeps in this browser (likes, mood profile, queue, chat).
function DeviceData({ inline = false }) {
  const [done, setDone] = useState(false);
  useEffect(() => setDone(false), []);
  const clear = () => {
    ['moodify.feedback.v1', 'moodify.profile.v1', 'moodify.player.v1'].forEach((key) => removeKey(key));
    ['moodify.queue.v1', 'moodify.assistant.v1'].forEach((key) => removeKey(key, 'session'));
    setDone(true);
    window.setTimeout(() => window.location.reload(), 600);
  };
  const body = (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn-ghost" onClick={clear}>
        Clear data on this device
      </button>
      <span className="text-sm text-silver">{done ? 'Cleared. Reloading…' : 'Removes likes, mood profile, queue and chat saved in this browser.'}</span>
    </div>
  );
  if (inline) return body;
  return (
    <Window title="device.cfg" status="this browser">
      <div className="p-5 sm:p-6">{body}</div>
    </Window>
  );
}
