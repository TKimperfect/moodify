import Window from '../ui/Window.jsx';
import PixelGlyph from '../ui/PixelGlyph.jsx';
import { MOODS, MAX_MOODS } from '../../data/moods.js';

// The ten mood tiles. Clicking a tile switches it on or off.
// "selected" (a list of mood ids) and "onChange" come from the page,
// so later phases can send the selection to the recommendation engine.
export default function MoodGrid({ selected, onChange }) {
  const limitReached = selected.length >= MAX_MOODS;

  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else if (!limitReached) {
      onChange([...selected, id]);
    }
  }

  const labels = MOODS.filter((mood) => selected.includes(mood.id)).map((mood) => mood.label);

  return (
    <Window title="01 // mood_select.exe" status={`${selected.length}/${MAX_MOODS} selected`} aria-labelledby="mood-heading">
      <div className="p-4 sm:p-6">
        <h2 id="mood-heading" className="font-display text-lg tracking-wider text-frost">
          Pick what fits
        </h2>
        <p className="mt-1.5 text-sm text-silver">
          Choose up to {MAX_MOODS}. Feelings overlap, so mix them freely.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5" role="group" aria-labelledby="mood-heading">
          {MOODS.map((mood) => {
            const isOn = selected.includes(mood.id);
            const blocked = limitReached && !isOn;
            return (
              <button
                key={mood.id}
                type="button"
                className={`mood-tile ${blocked ? 'cursor-not-allowed opacity-40 hover:translate-y-0 hover:border-line hover:text-silver' : ''}`}
                aria-pressed={isOn}
                aria-disabled={blocked}
                onClick={() => toggle(mood.id)}
              >
                <PixelGlyph rows={mood.glyph} className={`h-7 w-7 ${isOn ? 'text-orchid' : ''}`} />
                <span>
                  <span className="block font-medium text-inherit">{mood.label}</span>
                  <span className="mt-0.5 block text-xs text-silver">{mood.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t border-line bg-void/60 px-4 py-3 sm:px-6">
        <p className="pixel-label text-silver" aria-live="polite">
          {labels.length === 0 ? (
            <>&gt; waiting for input</>
          ) : (
            <>
              &gt; feeling: <span className="text-orchid">{labels.join(' + ')}</span>
              {limitReached && <span className="text-rose"> · max reached</span>}
            </>
          )}
        </p>
        <button type="button" className="btn-ghost" onClick={() => onChange([])} disabled={labels.length === 0}>
          Clear
        </button>
      </div>
    </Window>
  );
}
