import Window from '../ui/Window.jsx';
import { MOODS } from '../../data/moods.js';
import { DESIRED_EFFECTS, GENRES, ENERGY_WORDS, INTENSITY_WORDS } from '../../data/spectrum.js';
import { levelWord } from '../../lib/moodProfile.js';

const label = (list, id) => list.find((item) => item.id === id)?.label ?? id;

function Meter({ name, value, words }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-silver">{name}</span>
        <span className="pixel-label text-chrome">{value === null || value === undefined ? '?' : `${levelWord(value, words)} · ${value}`}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full border border-line bg-ink" aria-hidden="true">
        <span className="block h-full bg-gradient-to-r from-violet to-orchid transition-[width] duration-500" style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

// Shows, live, what the assistant has understood so far.
export default function ReadingPanel({ state, profile, notes, source, onShowSongs, onFineTune, onReset }) {
  const current = profile ?? state ?? {};
  const moods = current.moods ?? [];
  const effect = current.desired_effect;
  const tempo = current.tempo;
  const genres = current.genres ?? [];

  return (
    <Window title="reading.log" status={profile ? 'ready' : 'listening'} aria-labelledby="reading-heading">
      <div className="space-y-5 p-4 sm:p-5" aria-live="polite">
        <h2 id="reading-heading" className="font-display text-base tracking-wider text-frost">
          What I'm hearing
        </h2>

        <div>
          <p className="text-sm text-silver">Feeling</p>
          <div className="mt-1.5 flex min-h-7 flex-wrap gap-1.5">
            {moods.length ? (
              moods.map((id) => (
                <span key={id} className="tag tag-mood">
                  {label(MOODS, id)}
                </span>
              ))
            ) : (
              <span className="pixel-label text-silver">not yet</span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm text-silver">Music should</p>
          <p className="mt-1 text-frost">{effect ? label(DESIRED_EFFECTS, effect) : <span className="pixel-label text-silver">not yet</span>}</p>
        </div>

        <Meter name="Energy" value={current.energy} words={ENERGY_WORDS} />
        <Meter name="Intensity" value={current.intensity} words={INTENSITY_WORDS} />

        {(tempo && tempo !== 'any') || genres.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tempo && tempo !== 'any' && <span className="tag">{tempo} tempo</span>}
            {genres.map((id) => (
              <span key={id} className="tag">
                {label(GENRES, id)}
              </span>
            ))}
          </div>
        ) : null}

        {notes?.length > 0 && (
          <details className="text-sm">
            <summary className="pixel-label cursor-pointer text-silver hover:text-orchid">How I read your last message</summary>
            <ul className="mt-2 space-y-1 text-silver">
              {notes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="space-y-3 border-t border-line bg-void/60 p-4 sm:p-5">
        {profile ? (
          <>
            <button type="button" className="btn-chrome w-full" onClick={onShowSongs}>
              Show my songs
            </button>
            <button type="button" className="btn-ghost w-full" onClick={onFineTune}>
              Fine-tune first
            </button>
          </>
        ) : (
          <p className="text-sm text-silver">Your songs unlock once I know how you feel and what you want from the music.</p>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="pixel-label text-silver">{source === 'ai' ? 'AI · Claude' : source === 'rule-based' ? 'Built-in assistant' : ''}</span>
          <button type="button" className="text-sm text-silver underline underline-offset-4 hover:text-orchid" onClick={onReset}>
            Start over
          </button>
        </div>
      </div>
    </Window>
  );
}
