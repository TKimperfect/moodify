import Window from '../ui/Window.jsx';
import RangeSlider from '../ui/RangeSlider.jsx';
import Choice from '../ui/Choice.jsx';
import { useMoodProfile } from '../../context/MoodProfileContext.jsx';
import { levelWord } from '../../lib/moodProfile.js';
import { ENERGY_WORDS, INTENSITY_WORDS, TEMPOS } from '../../data/spectrum.js';

// Step 02: energy, emotional intensity and tempo.
export default function SpectrumPanel() {
  const { draft, setSpectrum, useSuggestedSpectrum, setField } = useMoodProfile();

  let note = 'Neutral start. Move the sliders to where you are.';
  if (draft.spectrumTouched) note = 'Set by you.';
  else if (draft.moods.length > 0) note = 'Starting point from your moods. Adjust freely.';

  return (
    <Window title="02 // spectrum.exe" status="fine tune" aria-labelledby="spectrum-heading">
      <div className="space-y-7 p-4 sm:p-6">
        <div>
          <h2 id="spectrum-heading" className="font-display text-lg tracking-wider text-frost">
            Tune the signal
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-silver">
            <span aria-live="polite">{note}</span>
            {draft.spectrumTouched && draft.moods.length > 0 && (
              <button type="button" className="text-orchid underline underline-offset-4 hover:text-frost" onClick={useSuggestedSpectrum}>
                Use suggestion
              </button>
            )}
          </p>
        </div>

        <RangeSlider
          label="Energy level"
          value={draft.energy}
          onChange={(value) => setSpectrum('energy', value)}
          word={levelWord(draft.energy, ENERGY_WORDS)}
          lowLabel="drained"
          highLabel="wired"
        />
        <RangeSlider
          label="Emotional intensity"
          value={draft.intensity}
          onChange={(value) => setSpectrum('intensity', value)}
          word={levelWord(draft.intensity, INTENSITY_WORDS)}
          lowLabel="faint"
          highLabel="overwhelming"
        />

        <fieldset>
          <legend className="font-medium text-frost">Preferred tempo</legend>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TEMPOS.map((tempo) => (
              <Choice
                key={tempo.id}
                name="tempo"
                value={tempo.id}
                label={tempo.label}
                checked={draft.tempo === tempo.id}
                onChange={() => setField('tempo', tempo.id)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </Window>
  );
}
